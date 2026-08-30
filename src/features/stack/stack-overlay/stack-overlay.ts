import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeBoundingBox, computeStacks, findMergeTargets, computeCompactButtonBox, findStackByCompactButtonAtPoint } from '../stack'
import { DRAGGING_OPACITY } from '../../drag/card-drag'
import { CanvasTooltip } from '../../../shared/ui/canvas-tooltip'
import { drawCompactButton, drawMergeDim, drawMergePlus, drawMergeTargetBorder, drawSingleBox, drawSingleStack } from './stack-overlay-view'

const COMPACT_TOOLTIP_LABEL = 'Compacter le tas'
const COMPACT_TOOLTIP_GAP = 6

/** The stack border and handle are redrawn every frame from the cards on the stage, so they stay visible on every stack regardless of hover. */
export class StackOverlay {
    private app: Application
    private cardLayer: Container
    stackBorder: Graphics
    stackDragHandle: Graphics
    stackCompactButton: Graphics
    private compactTooltip: CanvasTooltip
    private draggedBorder: Graphics
    private draggedHandle: Graphics
    private mergeIndicator: Graphics
    private mergePlus: Graphics
    private cards: Card[]
    private draggedCards: Card[]
    private restStacks: Map<Card, Card[]>
    private draggedSourceCards: Card[] | null
    private draggedSourceGeos: { x: number; y: number; width: number; height: number }[]
    private hoveredCards: Set<Card> | null

    constructor(app: Application, cardLayer: Container) {
        this.app = app
        this.cardLayer = cardLayer
        this.stackBorder = new Graphics()
        this.stackDragHandle = new Graphics()
        this.stackCompactButton = new Graphics()
        this.compactTooltip = new CanvasTooltip()
        this.draggedBorder = new Graphics()
        this.draggedHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
        this.cards = []
        this.draggedCards = []
        this.restStacks = new Map()
        this.draggedSourceCards = null
        this.draggedSourceGeos = []
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

    addToStage(): void {
        this.cardLayer.addChildAt(this.stackBorder, 0)
        this.cardLayer.addChildAt(this.stackDragHandle, 1)
        this.cardLayer.addChildAt(this.stackCompactButton, 2)
        this.cardLayer.addChild(this.mergeIndicator)
        this.cardLayer.addChild(this.draggedBorder)
        this.cardLayer.addChild(this.draggedHandle)
        this.cardLayer.addChild(this.compactTooltip.view)
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
            this.draggedSourceGeos = []
            for (const stack of computeStacks(this.cards)) {
                for (const card of stack) {
                    this.restStacks.set(card, stack)
                }
            }
        } else if (this.draggedSourceCards === null) {
            const source = this.restStacks.get(draggingCard)
            if (source) {
                this.draggedSourceCards = source
                const remaining = source.filter((card: Card): boolean => card !== draggingCard)
                this.draggedSourceGeos = computeStacks(remaining).map(
                    (group: Card[]): { x: number; y: number; width: number; height: number } =>
                        computeBoundingBox(group),
                )
            }
        }

        const excluded = new Set<Card>(this.draggedSourceCards ?? [])
        const draggedStack = new Set<Card>(this.draggedCards)
        const stackedCards = this.cards.filter(
            (card: Card): boolean =>
                card.alpha !== DRAGGING_OPACITY && !excluded.has(card) && !draggedStack.has(card),
        )

        for (const box of this.draggedSourceGeos) {
            drawSingleBox(box, this.stackBorder, this.stackDragHandle)
        }
        for (const stack of computeStacks(stackedCards)) {
            drawSingleStack(stack, this.stackBorder, this.stackDragHandle)
            if (stack.length >= 2 && this.isHoveredStack(stack)) {
                drawCompactButton(stack, this.stackCompactButton)
            }
        }
        for (const stack of computeStacks(this.draggedCards)) {
            drawSingleStack(stack, this.draggedBorder, this.draggedHandle)
        }

        if (draggingCard) {
            this.drawSingleCardMergeIndicator(draggingCard)
        }

        // Cards can be brought to the front (drag start, stack drag, reordering)
        // after the tooltip was first appended in addToStage, so it must be
        // re-raised every frame to stay above them.
        this.cardLayer.addChild(this.compactTooltip.view)
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
}
