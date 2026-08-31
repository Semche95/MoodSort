import { Application, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import {
    computeBoundingBox,
    computeStacks,
    findMergeTargets,
    computeCompactButtonBox,
    findStackByCompactButtonAtPoint,
    computeNameButtonBox,
    findStackByNameButtonAtPoint,
    computeLabelAnchorPoint,
    computeStackLabel,
    STACK_NAME_MAX_WIDTH,
} from '../stack'
import { DRAGGING_OPACITY } from '../../drag/card-drag'
import { CanvasTooltip } from '../../../shared/ui/canvas-tooltip'
import { StackNameEditor } from './stack-name-editor'
import { drawCompactButton, drawNameButton, drawMergeDim, drawMergePlus, drawMergeTargetBorder, drawSingleBox, drawSingleStack } from './stack-overlay-view'

const COMPACT_TOOLTIP_LABEL = 'Compacter le tas'
const COMPACT_TOOLTIP_GAP = 6
const NAME_TOOLTIP_GAP = 6
const NAMED_TOOLTIP_LABEL = 'Renommer le tas'
const UNNAMED_TOOLTIP_LABEL = 'Nommer le tas'
const LABEL_FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const LABEL_FONT_SIZE = 20
// Shared with the inline editor's own max width (STACK_NAME_MAX_WIDTH), so a name never
// reads wider once committed as a label than it did while being typed.
const LABEL_MAX_WIDTH = STACK_NAME_MAX_WIDTH
const LABEL_ELLIPSIS = '…'

/**
 * Shortens `label` with a trailing ellipsis until `measureWidth` reports it
 * fits within `maxWidth`, so a label is never measured against Pixi's Text
 * layout directly in tests (the `measureWidth` callback is what's mocked).
 */
export function truncateLabel(label: string, maxWidth: number, measureWidth: (text: string) => number): string {
    if (measureWidth(label) <= maxWidth) {
        return label
    }
    let truncated = label
    while (truncated.length > 1 && measureWidth(truncated + LABEL_ELLIPSIS) > maxWidth) {
        truncated = truncated.slice(0, -1)
    }
    return truncated + LABEL_ELLIPSIS
}

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
    private labelContainer: Container
    private labelPool: Text[]
    private draggedLabelContainer: Container
    private draggedLabelPool: Text[]
    private getStackNames: () => Record<string, string>
    private draggedBorder: Graphics
    private draggedHandle: Graphics
    private mergeIndicator: Graphics
    private mergePlus: Graphics
    private cards: Card[]
    private draggedCards: Card[]
    private restStacks: Map<Card, Card[]>
    private draggedSourceCards: Card[] | null
    private draggedSourceGroups: Card[][]
    private draggedSourceLabelPoint: Position | null
    private hoveredCards: Set<Card> | null

    constructor(app: Application, cardLayer: Container, getStackNames: () => Record<string, string> = (): Record<string, string> => ({})) {
        this.app = app
        this.cardLayer = cardLayer
        this.getStackNames = getStackNames
        this.stackBorder = new Graphics()
        this.stackDragHandle = new Graphics()
        this.stackCompactButton = new Graphics()
        this.stackNameButton = new Graphics()
        this.compactTooltip = new CanvasTooltip()
        this.nameTooltip = new CanvasTooltip()
        this.nameEditor = new StackNameEditor()
        this.labelContainer = new Container()
        this.labelContainer.label = 'stack-labels'
        // Purely decorative text: must never intercept pointer events meant for
        // the card underneath it (same pattern as CanvasTooltip and StackNameEditor).
        this.labelContainer.eventMode = 'none'
        this.labelPool = []
        this.draggedLabelContainer = new Container()
        this.draggedLabelContainer.label = 'dragged-stack-label'
        // Holds only the label of the stack actively being handle-dragged, kept
        // above its own cards (unlike labelContainer, which stays below them so
        // it can be covered while passing over other, stationary stacks).
        this.draggedLabelContainer.eventMode = 'none'
        this.draggedLabelPool = []
        this.draggedBorder = new Graphics()
        this.draggedHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
        this.cards = []
        this.draggedCards = []
        this.restStacks = new Map()
        this.draggedSourceCards = null
        this.draggedSourceGroups = []
        this.draggedSourceLabelPoint = null
        this.hoveredCards = null
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

        if (mergeTargets.length > 0) {
            for (const target of mergeTargets) {
                drawMergeTargetBorder(target, this.mergeIndicator)
                drawMergeDim(target, this.mergeIndicator)
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
                drawMergePlus(target, this.mergePlus)
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
        if (!draggingCard) {
            if (this.draggedCards.length === 0) {
                this.mergeIndicator.clear()
                this.mergePlus.clear()
            }
            this.draggedSourceCards = null
            this.draggedSourceGroups = []
            this.draggedSourceLabelPoint = null
            for (const stack of computeStacks(this.cards)) {
                for (const card of stack) {
                    this.restStacks.set(card, stack)
                }
            }
        } else if (this.draggedSourceCards === null) {
            const source = this.restStacks.get(draggingCard)
            if (source) {
                this.draggedSourceCards = source
                // Captured once, at drag start: the name belongs to the pile, not to
                // whichever card happens to carry it, so its label stays put at the
                // pile's original spot for the whole drag instead of tracking the
                // card that's moving.
                this.draggedSourceLabelPoint = computeLabelAnchorPoint(source)
                const remaining = source.filter((card: Card): boolean => card !== draggingCard)
                this.draggedSourceGroups = computeStacks(remaining)
            }
        }

        const excluded = new Set<Card>(this.draggedSourceCards ?? [])
        const draggedStack = new Set<Card>(this.draggedCards)
        const stackedCards = this.cards.filter(
            (card: Card): boolean =>
                card.alpha !== DRAGGING_OPACITY && !excluded.has(card) && !draggedStack.has(card),
        )

        const labelEntries: Array<{ stack: Card[]; point: Position }> = []

        for (const group of this.draggedSourceGroups) {
            // The card being pulled out is still mid-drag (not dropped yet): its
            // stack-mates left behind still need their border/handle drawn.
            drawSingleBox(computeBoundingBox(group), this.stackBorder, this.stackDragHandle)
        }
        if (this.draggedSourceCards && this.draggedSourceLabelPoint && this.draggedSourceGroups.length > 0) {
            // One label for the whole original pile, computed from every card that
            // was in it (so it's correct whether the departing card carried the name
            // or not), shown at its frozen pre-drag spot regardless of which card
            // ends up carrying the name around the canvas. But if draggedSourceGroups
            // is empty, the dragged card was alone in its own pile (a plain
            // single-card drag, not a handle drag): there's no pile left behind to
            // show a frame for, so there's nothing left to show a label for either.
            labelEntries.push({ stack: this.draggedSourceCards, point: this.draggedSourceLabelPoint })
        }
        for (const stack of computeStacks(stackedCards)) {
            drawSingleStack(stack, this.stackBorder, this.stackDragHandle)
            labelEntries.push({ stack, point: computeLabelAnchorPoint(stack) })
            if (this.isHoveredStack(stack)) {
                if (stack.length >= 2) {
                    drawCompactButton(stack, this.stackCompactButton)
                }
                drawNameButton(stack, this.stackNameButton)
            }
        }
        const draggedLabelEntries: Array<{ stack: Card[]; point: Position }> = []
        for (const stack of computeStacks(this.draggedCards)) {
            drawSingleStack(stack, this.draggedBorder, this.draggedHandle)
            // Routed to draggedLabelEntries, not labelEntries: this is the label of the
            // stack actually being carried, so it must stay above its own cards, not
            // below them like the "coverable" labels of stationary stacks.
            draggedLabelEntries.push({ stack, point: computeLabelAnchorPoint(stack) })
        }
        this.updateLabels(labelEntries, this.labelPool, this.labelContainer)
        this.updateLabels(draggedLabelEntries, this.draggedLabelPool, this.draggedLabelContainer)

        if (draggingCard) {
            this.drawSingleCardMergeIndicator(draggingCard)
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

    /**
     * Redraws every currently-visible stack name label from a pool of Text
     * instances, reusing existing ones and hiding (not destroying) any
     * surplus from a previous frame that no longer has a label to show. A
     * label is never explicitly hidden because something is dragged over it:
     * whatever's being dragged is simply re-raised above `container` at the
     * end of render(), so an opaque card passing over a label covers it as
     * an ordinary painter's-algorithm z-order effect, nothing more. Called
     * once per pool/container pair: one for stationary ("coverable") labels,
     * one for the actively handle-dragged stack's own label, which must stay
     * above its own cards instead.
     */
    private updateLabels(entries: Array<{ stack: Card[]; point: Position }>, pool: Text[], container: Container): void {
        const stackNames = this.getStackNames()
        let used = 0
        for (const { stack, point } of entries) {
            const label = computeStackLabel(stack, this.cardLayer, stackNames)
            if (!label) {
                continue
            }
            let text = pool[used]
            if (!text) {
                text = new Text({
                    text: '',
                    style: {
                        fontFamily: LABEL_FONT_FAMILY,
                        fontSize: LABEL_FONT_SIZE,
                        fontWeight: 'bold',
                        fill: 0xffffff,
                        stroke: { color: 0x000000, width: 3 },
                    },
                })
                // Top-anchored (not centered): the label only grows downward from
                // computeLabelAnchorPoint, so it never creeps up onto the handle above it.
                text.anchor.set(0.5, 0)
                pool.push(text)
                container.addChild(text)
            }
            const measureWidth = (candidate: string): number => {
                text.text = candidate
                return text.width
            }
            text.text = truncateLabel(label, LABEL_MAX_WIDTH, measureWidth)
            text.position.set(point.x, point.y)
            text.visible = true
            used++
        }
        for (let i = used; i < pool.length; i++) {
            pool[i].visible = false
        }
    }

    private drawSingleCardMergeIndicator(draggingCard: Card): void {
        this.mergeIndicator.clear()
        this.mergePlus.clear()

        const mergeTargets = findMergeTargets(
            [draggingCard],
            computeStacks(this.cards.filter((card: Card): boolean => card !== draggingCard)),
            this.draggedSourceCards,
        )

        if (mergeTargets.length === 0) {
            return
        }

        for (const target of mergeTargets) {
            drawMergeTargetBorder(target, this.mergeIndicator)
            drawMergeDim(target, this.mergeIndicator)
        }
        this.cardLayer.addChild(this.mergeIndicator)
        for (const target of mergeTargets) {
            drawMergePlus(target, this.mergePlus)
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
            COMPACT_TOOLTIP_LABEL,
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
            hasName ? NAMED_TOOLTIP_LABEL : UNNAMED_TOOLTIP_LABEL,
        )
    }

    private handleNameOut: () => void = (): void => {
        this.nameTooltip.hide()
    }
}
