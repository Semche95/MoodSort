import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeStacks } from '../stack'
import { computeBoundingBox } from '../stack-geometry'
import { findMergeTargets } from '../stack-merge'
import {
    computeCompactButtonBox,
    findStackByCompactButtonAtPoint,
    computeNameButtonBox,
    findStackByNameButtonAtPoint,
} from '../stack-hit-testing'
import { computeLabelAnchorPoint, computeStackLabel } from '../stack-naming'
import { DRAGGING_OPACITY } from '../../drag/card-drag'
import { CanvasTooltip } from '../../../shared/ui/canvas-tooltip'
import { StackNameEditor } from './stack-name-editor'
import { StackLabelPool } from './stack-label-pool'
import { StackDragSourceTracker } from './stack-drag-source-tracker'
import { drawCompactButton, drawNameButton, drawMergeDim, drawMergePlus, drawMergeTargetBorder, drawSingleBox, drawSingleStack } from './stack-overlay-view'
import { I18n } from '../../../i18n/I18n'
import type { GetResolvedTheme } from '../../../types/theme.types'
import { DEFAULT_GET_RESOLVED_THEME, getPixiThemeColors } from '../../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'

const COMPACT_TOOLTIP_GAP = 6
const NAME_TOOLTIP_GAP = 6

/** The stack border and handle are redrawn every frame from the cards on the stage, so they stay visible on every stack regardless of hover. */
export class StackOverlay {
    private app: Application
    private cardLayer: Container
    stackBorder: Graphics
    stackDragHandle: Graphics
    stackCompactButton: Graphics
    stackNameButton: Graphics
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
        this.labelPool = new StackLabelPool(labelContainer, cardLayer, getStackNames)
        const draggedLabelContainer = new Container()
        draggedLabelContainer.label = 'dragged-stack-label'
        // Holds only the label of the stack actively being handle-dragged, kept
        // above its own cards (unlike labelContainer, which stays below them so
        // it can be covered while passing over other, stationary stacks).
        draggedLabelContainer.eventMode = 'none'
        this.draggedLabelPool = new StackLabelPool(draggedLabelContainer, cardLayer, getStackNames)
        this.dragSourceTracker = new StackDragSourceTracker()
        this.draggedBorder = new Graphics()
        this.draggedHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
        this.cards = []
        this.draggedCards = []
        this.hoveredCards = null
    }

    private get labelContainer(): Container {
        return this.labelPool.container
    }

    private get draggedLabelContainer(): Container {
        return this.draggedLabelPool.container
    }

    initHandle(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackBorder.eventMode = 'passive'
        this.stackDragHandle.eventMode = 'static'
        this.stackDragHandle.cursor = 'grab'
        this.stackDragHandle.on('pointerdown', onPointerDown)
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
        this.stackNameButton.on('pointerout', this.handleNameOut)
    }

    /** Opens the inline Pixi name editor anchored at (x, y), prefilled with `initial`. */
    openNameEditor(x: number, y: number, initial: string, onCommit: (value: string) => void, onCancel: () => void): void {
        this.nameTooltip.hide()
        this.nameEditor.open(x, y, initial, onCommit, onCancel)
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
        this.cardLayer.addChildAt(this.stackNameButton, 3)
        this.cardLayer.addChild(this.mergeIndicator)
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)
        // Matches the exact order these are re-raised in every render() frame,
        // so that first frame's re-raise is a no-op instead of a visible reorder.
        this.cardLayer.addChild(this.labelContainer)
        this.cardLayer.addChild(this.draggedLabelContainer)
        this.cardLayer.addChild(this.compactTooltip.view)
        this.cardLayer.addChild(this.nameTooltip.view)
        this.cardLayer.addChild(this.nameEditor.view)
        this.collectCards()
        this.app.ticker.add(this.render)
    }

    showHighlight(stack: Card[]): void {
        void stack
        this.mergeIndicator.clear()
        this.mergePlus.clear()
    }

    /**
     * Records which stack the pointer is currently hovering, so the compact
     * button is only drawn for that stack (it must stay hidden otherwise).
     */
    setHoveredStack(stack: Card[] | null): void {
        this.hoveredCards = stack ? new Set(stack) : null
    }

    private isHoveredStack(stack: Card[]): boolean {
        const hovered = this.hoveredCards
        if (!hovered || stack.length !== hovered.size) {
            return false
        }
        return stack.every((card: Card): boolean => hovered.has(card))
    }

    showDragHighlights(
        draggedStack: Card[],
        mergeTargets: Card[][],
    ): void {
        this.draggedCards = draggedStack
        this.mergeIndicator.clear()
        this.mergePlus.clear()
        const palette = getPixiThemeColors(this.getResolvedTheme()).stackOverlay

        if (mergeTargets.length > 0) {
            for (const target of mergeTargets) {
                drawMergeTargetBorder(target, this.mergeIndicator, palette)
                drawMergeDim(target, this.mergeIndicator, palette)
            }
            this.cardLayer.addChild(this.mergeIndicator)
        }

        for (const card of draggedStack) {
            this.cardLayer.addChild(card)
        }
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)

        if (mergeTargets.length > 0) {
            for (const target of mergeTargets) {
                drawMergePlus(target, this.mergePlus, palette)
            }
            this.cardLayer.addChild(this.mergePlus)
        }
    }

    hide(): void {
        this.mergeIndicator.clear()
        this.mergePlus.clear()
    }

    restoreZOrder(): void {
        this.draggedCards = []
        this.cardLayer.addChildAt(this.stackBorder, 0)
        this.cardLayer.addChildAt(this.stackDragHandle, 1)
        this.cardLayer.addChildAt(this.stackCompactButton, 2)
        this.cardLayer.addChildAt(this.stackNameButton, 3)
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

        const draggingCard = this.cards.find(
            (card: Card): boolean => card.alpha === DRAGGING_OPACITY,
        )
        if (draggingCard) {
            this.compactTooltip.hide()
        }
        if (!draggingCard && this.draggedCards.length === 0) {
            this.mergeIndicator.clear()
            this.mergePlus.clear()
        }
        this.dragSourceTracker.captureIfDragStarted(this.cards, draggingCard)

        const excluded = new Set<Card>(this.dragSourceTracker.sourceCards ?? [])
        const draggedStack = new Set<Card>(this.draggedCards)
        const stackedCards = this.cards.filter(
            (card: Card): boolean =>
                card.alpha !== DRAGGING_OPACITY && !excluded.has(card) && !draggedStack.has(card),
        )

        const labelEntries: Array<{ stack: Card[]; point: Position }> = []

        for (const group of this.dragSourceTracker.sourceGroups) {
            // The card being pulled out is still mid-drag (not dropped yet): its
            // stack-mates left behind still need their border/handle drawn.
            drawSingleBox(computeBoundingBox(group), this.stackBorder, this.stackDragHandle, palette)
        }
        if (
            this.dragSourceTracker.sourceCards &&
            this.dragSourceTracker.sourceLabelPoint &&
            this.dragSourceTracker.sourceGroups.length > 0
        ) {
            // One label for the whole original pile, computed from every card that
            // was in it (so it's correct whether the departing card carried the name
            // or not), shown at its frozen pre-drag spot regardless of which card
            // ends up carrying the name around the canvas. But if sourceGroups
            // is empty, the dragged card was alone in its own pile (a plain
            // single-card drag, not a handle drag): there's no pile left behind to
            // show a frame for, so there's nothing left to show a label for either.
            labelEntries.push({ stack: this.dragSourceTracker.sourceCards, point: this.dragSourceTracker.sourceLabelPoint })
        }
        for (const stack of computeStacks(stackedCards)) {
            drawSingleStack(stack, this.stackBorder, this.stackDragHandle, palette)
            labelEntries.push({ stack, point: computeLabelAnchorPoint(stack) })
            if (this.isHoveredStack(stack)) {
                if (stack.length >= 2) {
                    drawCompactButton(stack, this.stackCompactButton, palette)
                }
                drawNameButton(stack, this.stackNameButton, palette)
            }
        }
        const draggedLabelEntries: Array<{ stack: Card[]; point: Position }> = []
        for (const stack of computeStacks(this.draggedCards)) {
            drawSingleStack(stack, this.draggedBorder, this.draggedHandle, palette)
            // Routed to draggedLabelEntries, not labelEntries: this is the label of the
            // stack actually being carried, so it must stay above its own cards, not
            // below them like the "coverable" labels of stationary stacks.
            draggedLabelEntries.push({ stack, point: computeLabelAnchorPoint(stack) })
        }
        this.labelPool.update(labelEntries, palette)
        this.draggedLabelPool.update(draggedLabelEntries, palette)

        if (draggingCard) {
            this.drawSingleCardMergeIndicator(draggingCard, palette)
        }

        // Cards can be brought to the front (drag start, stack drag, reordering)
        // after these were first appended in addToStage, so they must be
        // re-raised every frame to stay above them. draggedLabelContainer is
        // re-raised here too, unconditionally like labelContainer, so its resting
        // z-order stays stable frame to frame even while nothing is being dragged
        // (it has nothing visible to show then anyway).
        this.cardLayer.addChild(this.labelContainer)
        this.cardLayer.addChild(this.draggedLabelContainer)
        // Whatever's actively being dragged must render above the labels just
        // re-raised above, so dragging a stack over another stack's name
        // visually covers that name instead of it floating above the drag.
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
            // above its own cards, unlike other stacks' labels, which the drag is
            // free to pass over/cover.
            this.cardLayer.addChild(this.draggedLabelContainer)
        }
        this.cardLayer.addChild(this.compactTooltip.view)
        this.cardLayer.addChild(this.nameTooltip.view)
        this.cardLayer.addChild(this.nameEditor.view)
    }

    private drawSingleCardMergeIndicator(draggingCard: Card, palette: PixiThemePalette['stackOverlay']): void {
        this.mergeIndicator.clear()
        this.mergePlus.clear()

        const mergeTargets = findMergeTargets(
            [draggingCard],
            computeStacks(this.cards.filter((card: Card): boolean => card !== draggingCard)),
            this.dragSourceTracker.sourceCards,
        )

        if (mergeTargets.length === 0) {
            return
        }

        for (const target of mergeTargets) {
            drawMergeTargetBorder(target, this.mergeIndicator, palette)
            drawMergeDim(target, this.mergeIndicator, palette)
        }
        this.cardLayer.addChild(this.mergeIndicator)
        for (const target of mergeTargets) {
            drawMergePlus(target, this.mergePlus, palette)
        }
        this.cardLayer.addChild(this.mergePlus)
    }

    private handleCompactHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
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
        this.compactTooltip.hide()
    }

    private handleNameHover: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        const point: Position = { x: e.global.x, y: e.global.y }
        const stacks = computeStacks(this.cards)
        const stack = findStackByNameButtonAtPoint(stacks, point)
        if (!stack) {
            this.nameTooltip.hide()
            return
        }
        const rect = computeNameButtonBox(stack)
        const hasName = computeStackLabel(stack, this.cardLayer, this.getStackNames()).length > 0
        this.nameTooltip.show(
            rect.x + rect.width / 2,
            rect.y + rect.height + NAME_TOOLTIP_GAP,
            hasName ? I18n.t('stack.nameTooltipNamed') : I18n.t('stack.nameTooltipUnnamed'),
        )
    }

    private handleNameOut: () => void = (): void => {
        this.nameTooltip.hide()
    }
}
