import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeStacks } from '../stack'
import { computeBoundingBox } from '../stack-geometry'
import { findMergeTargets } from '../stack-merge'
import {
    computeCompactButtonBox,
    computeStackNameMaxWidth,
    computeStackPillLayout,
    computeStackPillMaxWidth,
    findStackByCompactButtonAtPoint,
    isPointInBox,
} from '../stack-hit-testing'
import { computeStackLabel, pickWinningGroup } from '../stack-naming'
import { isCardDragged } from '../../card/card-lift'
import { CanvasTooltip } from '../../../shared/ui/canvas-tooltip'
import { StackNameEditor } from './stack-name-editor'
import { StackLabelPool } from './stack-label-pool'
import { StackDragSourceTracker } from './stack-drag-source-tracker'
import { drawCompactButton, drawMergePlus, drawMergeWash, drawNameButton, drawStackFrame, drawStackPill } from './stack-overlay-view'
import { I18n } from '../../../i18n/I18n'
import type { GetResolvedTheme } from '../../../types/theme.types'
import { DEFAULT_GET_RESOLVED_THEME, getPixiThemeColors } from '../../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'
import type { StackOverlayEntry } from '../../../types/stack-overlay-entry.types'
import type { StackDrawTarget } from '../../../types/stack-draw-target.types'

const COMPACT_TOOLTIP_GAP = 6
const NAME_TOOLTIP_GAP = 6

function isSameStack(stack: Card[], cards: Set<Card> | null): boolean {
    if (!cards || stack.length !== cards.size) {
        return false
    }
    return stack.every((card: Card): boolean => cards.has(card))
}

/**
 * Every stack's frame and top pill (grip, name, rename button) are redrawn every frame from the
 * cards on the stage, so they stay visible on every stack regardless of hover; the compact pill
 * on the frame's bottom edge only shows on the hovered stack.
 */
export class StackOverlay {
    private app: Application
    private cardLayer: Container
    stackBorder: Graphics
    stackDragHandle: Graphics
    stackCompactButton: Graphics
    stackNameButton: Graphics
    private pillTopLayer: Container
    private compactTooltip: CanvasTooltip
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
    private compactPointer: Position | null
    private editingCards: Set<Card> | null
    private entries: StackOverlayEntry[]
    private mergeTargets: Card[][]

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
        this.stackCompactButton = new Graphics()
        this.stackNameButton = new Graphics()
        this.compactTooltip = new CanvasTooltip(getResolvedTheme)
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
        this.compactPointer = null
        this.editingCards = null
        this.entries = []
        this.mergeTargets = []
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

    initCompactButton(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackCompactButton.eventMode = 'static'
        this.stackCompactButton.cursor = 'pointer'
        this.stackCompactButton.on('pointerdown', onPointerDown)
        this.stackCompactButton.on('pointerover', this.handleCompactHover)
        this.stackCompactButton.on('pointermove', this.handleCompactHover)
        this.stackCompactButton.on('pointerout', this.handleCompactOut)
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
        this.cardLayer.addChildAt(this.stackCompactButton, 2)
        this.cardLayer.addChildAt(this.pillTopLayer, 3)
        this.cardLayer.addChild(this.mergeIndicator)
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)
        // Matches the exact order these are re-raised in every render() frame,
        // so that first frame's re-raise is a no-op instead of a visible reorder.
        this.cardLayer.addChild(this.draggedLabelContainer)
        this.cardLayer.addChild(this.compactTooltip.view)
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
     * Records which stack the pointer is currently hovering, so the compact
     * button is only drawn for that stack (it must stay hidden otherwise).
     */
    setHoveredStack(stack: Card[] | null): void {
        this.hoveredCards = stack ? new Set(stack) : null
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
        this.cardLayer.addChildAt(this.stackCompactButton, 2)
        this.cardLayer.addChildAt(this.pillTopLayer, 3)
    }

    private collectCards(): void {
        this.cards = this.cardLayer.children.filter(
            (child: Container): child is Card => 'imageUrl' in child,
        )
    }

    private render: () => void = (): void => {
        // Read fresh every frame so a theme flip recolors borders/handles/labels on the next tick.
        const palette = getPixiThemeColors(this.getResolvedTheme()).stackOverlay
        this.stackBorder.clear()
        this.stackDragHandle.clear()
        this.stackCompactButton.clear()
        this.stackNameButton.clear()
        this.draggedBorder.clear()
        this.draggedHandle.clear()

        const draggingCard = this.cards.find(isCardDragged)
        if (draggingCard || this.draggedCards.length > 0) {
            this.compactTooltip.hide()
            this.nameTooltip.hide()
            this.namePointer = null
            this.compactPointer = null
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
                const compactRect = computeCompactButtonBox(stack)
                const compactHovered = compactRect !== null && this.compactPointer !== null && isPointInBox(this.compactPointer, compactRect)
                drawCompactButton(stack, this.stackCompactButton, compactHovered, palette)
            }
        }
        for (const stack of computeStacks(this.draggedCards)) {
            this.drawStack(stack, computeStackLabel(stack, this.cardLayer, stackNames), false, carried, palette)
        }
        this.entries = entries
        this.labelPool.end()
        this.draggedLabelPool.end()

        // Cards can be brought to the front (drag start, stack drag, reordering)
        // after these were first appended in addToStage, so they must be
        // re-raised every frame to stay above them. draggedLabelContainer is
        // re-raised unconditionally so its resting z-order stays stable frame
        // to frame even while nothing is being dragged (it is empty then).
        this.cardLayer.addChild(this.draggedLabelContainer)
        if (draggingCard) {
            this.cardLayer.addChild(draggingCard)
        }
        if (this.draggedCards.length > 0) {
            for (const card of this.draggedCards) {
                this.cardLayer.addChild(card)
            }
            this.cardLayer.addChild(this.draggedBorder)
            this.cardLayer.addChild(this.draggedHandle)
            // Re-raised a second time here, now above the dragged cards/border/handle
            // just re-raised above: the dragged stack's own name must stay readable
            // above its own cards.
            this.cardLayer.addChild(this.draggedLabelContainer)
        }
        // Above everything dragged: the `+` must stay visible over the cards about to land on it.
        if (this.mergeTargets.length > 0) {
            this.cardLayer.addChild(this.mergePlus)
        }
        this.cardLayer.addChild(this.compactTooltip.view)
        this.cardLayer.addChild(this.nameTooltip.view)
        this.cardLayer.addChild(this.nameEditor.view)
    }

    private drawStack(stack: Card[], label: string, hovered: boolean, target: StackDrawTarget, palette: PixiThemePalette['stackOverlay']): StackOverlayEntry {
        const box = computeBoundingBox(stack)
        const name = label ? target.labels.take(label, computeStackNameMaxWidth(box), palette) : null
        const layout = computeStackPillLayout(box, name ? name.text.width : null)
        drawStackFrame(target.frame, layout.frame, hovered, palette)
        drawStackPill(target.pill, layout, palette)
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

    private handleCompactHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
        this.compactPointer = point
        const stack = findStackByCompactButtonAtPoint(computeStacks(this.cards), point)
        const rect = stack ? computeCompactButtonBox(stack) : null
        if (!rect) {
            this.compactTooltip.hide()
            return
        }
        this.compactTooltip.show(
            rect.x + rect.width / 2,
            rect.y + rect.height + COMPACT_TOOLTIP_GAP,
            I18n.t('stack.compactTooltip'),
        )
    }

    private handleCompactOut: () => void = (): void => {
        this.compactPointer = null
        this.compactTooltip.hide()
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
