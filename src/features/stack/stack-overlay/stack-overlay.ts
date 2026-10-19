import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeStacks, listLayerCards } from '../stack'
import { computeBoundingBox, computeCardLayoutKey } from '../stack-geometry'
import { findMergeTargets } from '../stack-merge'
import {
    computeStackActionsLayout,
    computeStackNameMaxWidth,
    computeStackPillLayout,
    computeStackPillMaxWidth,
    findStackActionAtPoint,
    isPointInBox,
} from '../stack-hit-testing'
import { computeStackLabel, pickWinningGroup } from '../stack-naming'
import { isCardDragged } from '../../card/card-lift'
import { CanvasTooltip } from '../../../shared/ui/canvas-tooltip'
import { StackNameEditor } from './stack-name-editor'
import { StackLabelPool } from './stack-label-pool'
import { StackDragSourceTracker } from './stack-drag-source-tracker'
import { drawMergePlus, drawMergeWash, drawNameButton, drawStackActions, drawStackFrame, drawStackPill } from './stack-overlay-view'
import { I18n } from '../../../i18n/I18n'
import type { GetResolvedTheme } from '../../../types/theme.types'
import { DEFAULT_GET_RESOLVED_THEME, getPixiThemeColors } from '../../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'
import type { StackOverlayEntry } from '../../../types/stack-overlay-entry.types'
import type { StackDrawTarget } from '../../../types/stack-draw-target.types'
import type { StackAction } from '../../../types/stack-actions-layout.types'
import type { TranslationKey } from '../../../i18n/i18n.types'

const ACTIONS_TOOLTIP_GAP = 6
const ACTION_TOOLTIP_KEYS: Record<StackAction, TranslationKey> = {
    compact: 'stack.compactTooltip',
    spread: 'stack.spreadTooltip',
}
const NAME_TOOLTIP_GAP = 6

function computeCardsKey(cards: Iterable<Card> | null): string {
    return cards ? [...cards].map((card: Card): string => card.imageUrl).join(',') : ''
}

function computePointKey(point: Position | null): string {
    return point ? `${point.x},${point.y}` : ''
}

/** Re-adding a child already in place still makes Pixi rebuild the layer's render structure, so it only happens when the order is off. */
function raiseToTop(layer: Container, children: Container[]): void {
    const tail = layer.children.slice(-children.length)
    if (tail.length === children.length && children.every((child: Container, index: number): boolean => tail[index] === child)) {
        return
    }
    for (const child of children) {
        layer.addChild(child)
    }
}

function isSameStack(stack: Card[], cards: Set<Card> | null): boolean {
    if (!cards || stack.length !== cards.size) {
        return false
    }
    return stack.every((card: Card): boolean => cards.has(card))
}

/**
 * Every stack's frame and top pill (grip, name, rename button) are redrawn from the cards on the
 * stage whenever anything they show changes, so they stay visible on every stack regardless of hover; the action pill
 * on the frame's bottom edge (compact, spread) only shows on the hovered stack.
 */
export class StackOverlay {
    private app: Application
    private cardLayer: Container
    stackBorder: Graphics
    stackDragHandle: Graphics
    stackActionsPill: Graphics
    stackNameButton: Graphics
    private pillTopLayer: Container
    private actionsTooltip: CanvasTooltip
    private nameTooltip: CanvasTooltip
    private nameEditor: StackNameEditor
    private labelPool: StackLabelPool
    private draggedLabelPool: StackLabelPool
    private dragSourceTracker: StackDragSourceTracker
    private getStackNames: () => Record<string, string>
    private getResolvedTheme: GetResolvedTheme
    private draggedBorder: Graphics
    private draggedHandle: Graphics
    private mergeIndicator: Graphics
    private mergePlus: Graphics
    private cards: Card[]
    private draggedCards: Card[]
    private hoveredCards: Set<Card> | null
    private namePointer: Position | null
    private armedCards: Set<Card> | null
    private actionsPointer: Position | null
    private editingCards: Set<Card> | null
    private entries: StackOverlayEntry[]
    private mergeTargets: Card[][]
    private renderKey: string

    constructor(
        app: Application,
        cardLayer: Container,
        getStackNames: () => Record<string, string> = (): Record<string, string> => ({}),
        getResolvedTheme: GetResolvedTheme = DEFAULT_GET_RESOLVED_THEME,
    ) {
        this.app = app
        this.cardLayer = cardLayer
        this.getStackNames = getStackNames
        this.getResolvedTheme = getResolvedTheme
        this.stackBorder = new Graphics()
        this.stackDragHandle = new Graphics()
        this.stackActionsPill = new Graphics()
        this.stackNameButton = new Graphics()
        this.actionsTooltip = new CanvasTooltip(getResolvedTheme)
        this.nameTooltip = new CanvasTooltip(getResolvedTheme)
        this.nameEditor = new StackNameEditor(getResolvedTheme)
        const labelContainer = new Container()
        labelContainer.label = 'stack-labels'
        // Purely decorative text: must never intercept pointer events meant for
        // the card underneath it (same pattern as CanvasTooltip and StackNameEditor).
        labelContainer.eventMode = 'none'
        this.labelPool = new StackLabelPool(labelContainer)
        // Names share the pill's layer, under every card, so a neighbouring pile covers name and pill alike;
        // a single child keeps the overlay at 4 bottom slots, the offset of card z-indices saved in undo history.
        this.pillTopLayer = new Container()
        this.pillTopLayer.addChild(labelContainer)
        this.pillTopLayer.addChild(this.stackNameButton)
        const draggedLabelContainer = new Container()
        draggedLabelContainer.label = 'dragged-stack-label'
        // Holds only the label of the stack actively being handle-dragged, kept
        // above its own cards like the rest of its pill.
        draggedLabelContainer.eventMode = 'none'
        this.draggedLabelPool = new StackLabelPool(draggedLabelContainer)
        this.dragSourceTracker = new StackDragSourceTracker()
        this.draggedBorder = new Graphics()
        this.draggedHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
        this.cards = []
        this.draggedCards = []
        this.hoveredCards = null
        this.namePointer = null
        this.armedCards = null
        this.actionsPointer = null
        this.editingCards = null
        this.entries = []
        this.mergeTargets = []
        this.renderKey = ''
    }

    private get draggedLabelContainer(): Container {
        return this.draggedLabelPool.container
    }

    initHandle(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackBorder.eventMode = 'passive'
        this.stackDragHandle.eventMode = 'static'
        this.stackDragHandle.cursor = 'grab'
        this.stackDragHandle.on('pointerdown', onPointerDown)
        this.stackDragHandle.on('pointerover', this.handlePillHover)
        this.stackDragHandle.on('pointermove', this.handlePillHover)
        this.stackDragHandle.on('pointerout', this.handleNameOut)
    }

    initActionsPill(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackActionsPill.eventMode = 'static'
        this.stackActionsPill.cursor = 'pointer'
        this.stackActionsPill.on('pointerdown', onPointerDown)
        this.stackActionsPill.on('pointerover', this.handleActionsHover)
        this.stackActionsPill.on('pointermove', this.handleActionsHover)
        this.stackActionsPill.on('pointerout', this.handleActionsOut)
    }

    initNameButton(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackNameButton.eventMode = 'static'
        this.stackNameButton.cursor = 'pointer'
        // A click that opens the inline editor must not also reach the stage-level
        // "click elsewhere closes the editor" handler in the same event dispatch.
        this.stackNameButton.on('pointerdown', (e: FederatedPointerEvent): void => {
            e.stopPropagation()
            onPointerDown(e)
        })
        this.stackNameButton.on('pointerover', this.handleNameHover)
        this.stackNameButton.on('pointermove', this.handleNameHover)
        this.stackNameButton.on('pointerout', this.handleNameButtonOut)
    }

    /** The stationary stack whose rename button is under `point`, as drawn on the last frame. */
    findStackByNameButtonAtPoint(point: Position): Card[] | null {
        return this.entries.find((entry: StackOverlayEntry): boolean => isPointInBox(point, entry.layout.pencil))?.stack ?? null
    }

    /** Opens the inline Pixi name editor over `stack`'s pill, prefilled with `initial`; the pill hides its own name meanwhile. */
    openNameEditor(stack: Card[], initial: string, onCommit: (value: string) => void, onCancel: () => void): void {
        this.nameTooltip.hide()
        const box = computeBoundingBox(stack)
        const { frame } = computeStackPillLayout(box, null)
        this.editingCards = new Set(stack)
        this.nameEditor.open(
            frame.x + frame.width / 2,
            frame.y,
            computeStackPillMaxWidth(box),
            initial,
            (value: string): void => {
                this.editingCards = null
                onCommit(value)
            },
            (): void => {
                this.editingCards = null
                onCancel()
            },
        )
    }

    /** Commits any pending edit in the name editor, e.g. on a click elsewhere ("blur"). */
    commitNameEditorIfOpen(): void {
        if (this.nameEditor.isOpen) {
            this.nameEditor.commit()
        }
    }

    addToStage(): void {
        this.cardLayer.addChildAt(this.stackBorder, 0)
        this.cardLayer.addChildAt(this.stackDragHandle, 1)
        this.cardLayer.addChildAt(this.stackActionsPill, 2)
        this.cardLayer.addChildAt(this.pillTopLayer, 3)
        this.cardLayer.addChild(this.mergeIndicator)
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)
        // Matches the exact order these are re-raised in every render() frame,
        // so that first frame's re-raise is a no-op instead of a visible reorder.
        this.cardLayer.addChild(this.draggedLabelContainer)
        this.cardLayer.addChild(this.actionsTooltip.view)
        this.cardLayer.addChild(this.nameTooltip.view)
        this.cardLayer.addChild(this.nameEditor.view)
        this.collectCards()
        this.app.ticker.add(this.render)
    }

    showHighlight(stack: Card[]): void {
        void stack
        this.clearMergeTargets()
    }

    /**
     * Records which stack the pointer is currently hovering, so the action pill
     * is only drawn for that stack (it must stay hidden otherwise).
     */
    setHoveredStack(stack: Card[] | null): void {
        this.hoveredCards = stack ? new Set(stack) : null
    }

    /** The stack a press would carry whole (Ctrl/Cmd held over it): its grip lights up. */
    setArmedStack(stack: Card[] | null): void {
        this.armedCards = stack ? new Set(stack) : null
    }

    showDragHighlights(
        draggedStack: Card[],
        mergeTargets: Card[][],
    ): void {
        this.draggedCards = draggedStack
        this.setMergeTargets(mergeTargets, getPixiThemeColors(this.getResolvedTheme()).stackOverlay)

        for (const card of draggedStack) {
            this.cardLayer.addChild(card)
        }
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)
    }

    hide(): void {
        this.clearMergeTargets()
    }

    private clearMergeTargets(): void {
        this.mergeTargets = []
        this.mergeIndicator.clear()
        this.mergePlus.clear()
    }

    /**
     * Single source of truth for the stacks the dragged cards would merge into: their own frames
     * switch to the accent on the next frame (drawn under their pills), while the wash and the
     * `+` sit above them.
     */
    private setMergeTargets(mergeTargets: Card[][], palette: PixiThemePalette['stackOverlay']): void {
        this.clearMergeTargets()
        this.mergeTargets = mergeTargets
        if (mergeTargets.length === 0) {
            return
        }
        for (const target of mergeTargets) {
            drawMergeWash(target, this.mergeIndicator, palette)
            drawMergePlus(target, this.mergePlus, palette)
        }
        this.cardLayer.addChild(this.mergeIndicator)
        this.cardLayer.addChild(this.mergePlus)
    }

    private isMergeTarget(stack: Card[]): boolean {
        return this.mergeTargets.some((target: Card[]): boolean => isSameStack(stack, new Set(target)))
    }

    restoreZOrder(): void {
        this.draggedCards = []
        this.cardLayer.addChildAt(this.stackBorder, 0)
        this.cardLayer.addChildAt(this.stackDragHandle, 1)
        this.cardLayer.addChildAt(this.stackActionsPill, 2)
        this.cardLayer.addChildAt(this.pillTopLayer, 3)
    }

    private collectCards(): void {
        this.cards = listLayerCards(this.cardLayer)
    }

    private render: () => void = (): void => {
        const draggingCard = this.cards.find(isCardDragged)
        const renderKey = this.computeRenderKey()
        if (renderKey !== this.renderKey) {
            this.renderKey = renderKey
            this.draw(draggingCard)
        }
        this.raiseAboveCards(draggingCard)
    }

    /**
     * Everything draw() reads: an unchanged key means the last drawing still holds, sparing a rebuild of every
     * frame and pill on each tick. A theme flip is part of it, so borders, handles and labels recolor on the next tick.
     */
    private computeRenderKey(): string {
        return [
            this.getResolvedTheme(),
            JSON.stringify(this.getStackNames()),
            computeCardLayoutKey(listLayerCards(this.cardLayer)),
            computeCardsKey(this.draggedCards),
            this.mergeTargets.map(computeCardsKey).join('/'),
            computeCardsKey(this.hoveredCards),
            computeCardsKey(this.armedCards),
            computeCardsKey(this.editingCards),
            computePointKey(this.namePointer),
            computePointKey(this.actionsPointer),
        ].join('#')
    }

    private draw(draggingCard: Card | undefined): void {
        const palette = getPixiThemeColors(this.getResolvedTheme()).stackOverlay
        this.stackBorder.clear()
        this.stackDragHandle.clear()
        this.stackActionsPill.clear()
        this.stackNameButton.clear()
        this.draggedBorder.clear()
        this.draggedHandle.clear()

        if (draggingCard || this.draggedCards.length > 0) {
            this.actionsTooltip.hide()
            this.nameTooltip.hide()
            this.namePointer = null
            this.actionsPointer = null
        }
        if (!draggingCard && this.draggedCards.length === 0) {
            this.clearMergeTargets()
        }
        this.dragSourceTracker.captureIfDragStarted(this.cards, draggingCard)
        if (draggingCard) {
            this.setMergeTargets(this.findSingleCardMergeTargets(draggingCard), palette)
        }

        const excluded = new Set<Card>(this.dragSourceTracker.sourceCards ?? [])
        const draggedStack = new Set<Card>(this.draggedCards)
        const stackedCards = this.cards.filter(
            (card: Card): boolean =>
                !isCardDragged(card) && !excluded.has(card) && !draggedStack.has(card),
        )
        const stackNames = this.getStackNames()
        const resting: StackDrawTarget = { frame: this.stackBorder, pill: this.stackDragHandle, pencil: this.stackNameButton, labels: this.labelPool }
        const carried: StackDrawTarget = { frame: this.draggedBorder, pill: this.draggedHandle, pencil: this.draggedHandle, labels: this.draggedLabelPool }
        this.labelPool.begin()
        this.draggedLabelPool.begin()

        // The card being pulled out is still mid-drag (not dropped yet): the pile it left keeps its
        // frames, and its whole name stays on the group that would inherit it if dropped right now.
        const sourceCards = this.dragSourceTracker.sourceCards
        const sourceGroups = this.dragSourceTracker.sourceGroups
        const namedSourceGroup = sourceCards && sourceGroups.length > 0 ? pickWinningGroup(sourceGroups, this.cardLayer) : null
        for (const group of sourceGroups) {
            const label = sourceCards && group === namedSourceGroup ? computeStackLabel(sourceCards, this.cardLayer, stackNames) : ''
            this.drawStack(group, label, false, resting, palette)
        }
        const entries: StackOverlayEntry[] = []
        for (const stack of computeStacks(stackedCards)) {
            const hovered = isSameStack(stack, this.hoveredCards)
            const label = isSameStack(stack, this.editingCards) ? '' : computeStackLabel(stack, this.cardLayer, stackNames)
            entries.push(this.drawStack(stack, label, hovered || this.isMergeTarget(stack), resting, palette))
            if (hovered) {
                const hoveredAction = this.actionsPointer ? findStackActionAtPoint([stack], this.actionsPointer)?.action ?? null : null
                drawStackActions(stack, this.stackActionsPill, hoveredAction, palette)
            }
        }
        for (const stack of computeStacks(this.draggedCards)) {
            this.drawStack(stack, computeStackLabel(stack, this.cardLayer, stackNames), false, carried, palette)
        }
        this.entries = entries
        this.labelPool.end()
        this.draggedLabelPool.end()
    }

    /**
     * Cards can be brought to the front (drag start, stack drag, reordering) after these were first
     * appended in addToStage, so they must be re-raised every frame to stay above them.
     */
    private raiseAboveCards(draggingCard: Card | undefined): void {
        const held = draggingCard ? [draggingCard] : []
        // draggedLabelContainer stays raised even while empty so its resting z-order is stable frame to frame;
        // with a stack carried it goes above the stack's own cards, border and handle so its name stays readable.
        const dragged = this.draggedCards.length > 0
            ? [...held, ...this.draggedCards, this.draggedBorder, this.draggedHandle, this.draggedLabelContainer]
            : [this.draggedLabelContainer, ...held]
        raiseToTop(this.cardLayer, [
            ...dragged,
            // Above everything dragged: the `+` must stay visible over the cards about to land on it.
            ...(this.mergeTargets.length > 0 ? [this.mergePlus] : []),
            this.actionsTooltip.view,
            this.nameTooltip.view,
            this.nameEditor.view,
        ])
    }

    private drawStack(stack: Card[], label: string, hovered: boolean, target: StackDrawTarget, palette: PixiThemePalette['stackOverlay']): StackOverlayEntry {
        const box = computeBoundingBox(stack)
        const name = label ? target.labels.take(label, computeStackNameMaxWidth(box), palette) : null
        const layout = computeStackPillLayout(box, name ? name.text.width : null)
        drawStackFrame(target.frame, layout.frame, hovered, palette)
        const gripLit = target.pill === this.stackDragHandle && isSameStack(stack, this.armedCards)
        drawStackPill(target.pill, layout, gripLit, palette)
        const pencilHovered = target.pencil === this.stackNameButton && this.namePointer !== null && isPointInBox(this.namePointer, layout.pencil)
        drawNameButton(layout, target.pencil, hovered, pencilHovered, palette)
        if (name && layout.name) {
            name.text.position.set(layout.name.x, layout.name.y)
        }
        return { stack, layout, label, truncated: name?.truncated ?? false }
    }

    private findSingleCardMergeTargets(draggingCard: Card): Card[][] {
        return findMergeTargets(
            [draggingCard],
            computeStacks(this.cards.filter((card: Card): boolean => card !== draggingCard)),
            this.dragSourceTracker.sourceCards,
        )
    }

    private handleActionsHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
        this.actionsPointer = point
        const hit = findStackActionAtPoint(computeStacks(this.cards), point)
        const rect = hit ? computeStackActionsLayout(hit.stack)?.[hit.action] : null
        if (!hit || !rect) {
            this.actionsTooltip.hide()
            return
        }
        this.actionsTooltip.show(
            rect.x + rect.width / 2,
            rect.y + rect.height + ACTIONS_TOOLTIP_GAP,
            I18n.t(ACTION_TOOLTIP_KEYS[hit.action]),
        )
    }

    private handleActionsOut: () => void = (): void => {
        this.actionsPointer = null
        this.actionsTooltip.hide()
    }

    private handleNameHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
        this.namePointer = point
        const entry = this.entries.find((candidate: StackOverlayEntry): boolean => isPointInBox(point, candidate.layout.pencil))
        if (!entry) {
            this.nameTooltip.hide()
            return
        }
        const { pencil } = entry.layout
        this.nameTooltip.show(
            pencil.x + pencil.width / 2,
            pencil.y + pencil.height + NAME_TOOLTIP_GAP,
            entry.label ? I18n.t('stack.nameTooltipNamed') : I18n.t('stack.nameTooltipUnnamed'),
        )
    }

    /** Spells out a name its pill had to shorten, wrapped to stay within the stack's frame. */
    private handlePillHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
        const entry = this.entries.find((candidate: StackOverlayEntry): boolean => isPointInBox(point, candidate.layout.pill))
        if (!entry?.truncated || this.draggedCards.length > 0) {
            this.nameTooltip.hide()
            return
        }
        const { frame, pill } = entry.layout
        this.nameTooltip.show(frame.x + frame.width / 2, pill.y + pill.height + NAME_TOOLTIP_GAP, entry.label, frame.width)
    }

    private handleNameOut: () => void = (): void => {
        this.nameTooltip.hide()
    }

    private handleNameButtonOut: () => void = (): void => {
        this.namePointer = null
        this.nameTooltip.hide()
    }
}
