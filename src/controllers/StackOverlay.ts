import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { computeBoundingBox } from '../utils/card'
import { computeStacks, findMergeTargets, computeCompactButtonBox, findStackByCompactButtonAtPoint } from '../utils/stack'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT, DRAGGING_OPACITY } from '../utils/constants'
import { CanvasTooltip } from '../ui/canvas-tooltip'

const COMPACT_TOOLTIP_LABEL = 'Compacter le tas'
const COMPACT_TOOLTIP_GAP = 6

/**
 * Manages all Graphics-based visual feedback for stacks:
 * permanent border/handle, drag merge indicators.
 * The stack border and handle are redrawn every frame from the cards on the
 * stage, so they are permanently visible on every stack regardless of hover.
 */
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
                this.drawMergeTargetBorder(target)
                this.drawMergeDim(target)
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
                this.drawMergePlus(target)
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
            this.drawSingleBox(box, this.stackBorder, this.stackDragHandle)
        }
        for (const stack of computeStacks(stackedCards)) {
            this.drawSingleStack(stack, this.stackBorder, this.stackDragHandle)
            if (stack.length >= 2 && this.isHoveredStack(stack)) {
                this.drawCompactButton(stack, this.stackCompactButton)
            }
        }
        for (const stack of computeStacks(this.draggedCards)) {
            this.drawSingleStack(stack, this.draggedBorder, this.draggedHandle)
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
            this.drawMergeTargetBorder(target)
            this.drawMergeDim(target)
        }
        this.cardLayer.addChild(this.mergeIndicator)
        for (const target of mergeTargets) {
            this.drawMergePlus(target)
        }
        this.cardLayer.addChild(this.mergePlus)
    }

    private drawSingleStack(stack: Card[], border: Graphics, handle: Graphics): void {
        this.drawSingleBox(computeBoundingBox(stack), border, handle)
    }

    private drawSingleBox(
        box: { x: number; y: number; width: number; height: number },
        border: Graphics,
        handle: Graphics,
    ): void {
        const pad = STACK_HIGHLIGHT_PADDING
        const bx = box.x - pad
        const by = box.y - pad
        const bw = box.width + pad * 2
        const bh = box.height + pad * 2

        border.rect(bx, by, bw, bh)
        border.fill({ color: 0x000000, alpha: 0.001 })
        border.rect(bx, by, bw, bh)
        border.stroke({ color: 0x333333, width: 2, alpha: 0.6 })

        const handleWidth = Math.min(bw, 80)
        const hx = bx + (bw - handleWidth) / 2
        const hy = by - STACK_HANDLE_HEIGHT / 2

        handle.roundRect(hx, hy, handleWidth, STACK_HANDLE_HEIGHT, 6)
        handle.fill({ color: 0x444444, alpha: 0.75 })
        this.drawGripIcon(hx, hy, handleWidth, handle)
    }

    private drawGripIcon(hx: number, hy: number, handleWidth: number, handle: Graphics): void {
        const cx = hx + handleWidth / 2
        const cy = hy + STACK_HANDLE_HEIGHT / 2
        const lineHalfWidth = 10
        const spacing = 4
        for (let i = -1; i <= 1; i++) {
            handle.rect(cx - lineHalfWidth, cy + i * spacing - 1, lineHalfWidth * 2, 2)
            handle.fill({ color: 0xaaaaaa, alpha: 0.9 })
        }
    }

    private drawCompactButton(stack: Card[], compactButton: Graphics): void {
        const rect = computeCompactButtonBox(stack)
        if (!rect) {
            return
        }
        compactButton.roundRect(rect.x, rect.y, rect.width, rect.height, 6)
        compactButton.fill({ color: 0x444444, alpha: 0.75 })
        this.drawCompactIcon(rect, compactButton)
    }

    /**
     * "Two converging arrows" icon: one from the top-right corner, one from
     * the bottom-left corner, both pointing toward the center along the same
     * diagonal, the classic "compact/squeeze together" metaphor. Drawn on a
     * 24x24 reference grid scaled to the button's actual size.
     */
    private drawCompactIcon(
        rect: { x: number; y: number; width: number; height: number },
        compactButton: Graphics,
    ): void {
        const scaleX = rect.width / 24
        const scaleY = rect.height / 24
        const toWorld = (px: number, py: number): { x: number; y: number } => ({
            x: rect.x + px * scaleX,
            y: rect.y + py * scaleY,
        })
        const thickness = 2 * Math.min(scaleX, scaleY)

        this.drawArrow(compactButton, toWorld(18, 6), toWorld(13, 11), thickness)
        this.drawArrow(compactButton, toWorld(6, 18), toWorld(11, 13), thickness)
    }

    private drawArrow(
        icon: Graphics,
        from: { x: number; y: number },
        to: { x: number; y: number },
        thickness: number,
    ): void {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / length
        const uy = dy / length
        const px = -uy
        const py = ux
        const halfThickness = thickness / 2
        const headLength = thickness * 2.5
        const halfHeadWidth = thickness * 1.25
        const shaftEndX = to.x - ux * headLength
        const shaftEndY = to.y - uy * headLength

        icon.moveTo(from.x + px * halfThickness, from.y + py * halfThickness)
        icon.lineTo(shaftEndX + px * halfThickness, shaftEndY + py * halfThickness)
        icon.lineTo(shaftEndX - px * halfThickness, shaftEndY - py * halfThickness)
        icon.lineTo(from.x - px * halfThickness, from.y - py * halfThickness)
        icon.closePath()
        icon.fill({ color: 0xaaaaaa, alpha: 0.9 })

        icon.moveTo(to.x, to.y)
        icon.lineTo(shaftEndX + px * halfHeadWidth, shaftEndY + py * halfHeadWidth)
        icon.lineTo(shaftEndX - px * halfHeadWidth, shaftEndY - py * halfHeadWidth)
        icon.closePath()
        icon.fill({ color: 0xaaaaaa, alpha: 0.9 })
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

    private drawMergeTargetBorder(stack: Card[]): void {
        const box = computeBoundingBox(stack)
        const bx = box.x - STACK_HIGHLIGHT_PADDING
        const by = box.y - STACK_HIGHLIGHT_PADDING
        const bw = box.width + STACK_HIGHLIGHT_PADDING * 2
        const bh = box.height + STACK_HIGHLIGHT_PADDING * 2

        this.mergeIndicator.rect(bx, by, bw, bh)
        this.mergeIndicator.fill({ color: 0x000000, alpha: 0.001 })
        this.mergeIndicator.rect(bx, by, bw, bh)
        this.mergeIndicator.stroke({ color: 0x333333, width: 2, alpha: 0.6 })
    }

    private drawMergeDim(stack: Card[]): void {
        const box = computeBoundingBox(stack)
        const bx = box.x - STACK_HIGHLIGHT_PADDING
        const by = box.y - STACK_HIGHLIGHT_PADDING
        const bw = box.width + STACK_HIGHLIGHT_PADDING * 2
        const bh = box.height + STACK_HIGHLIGHT_PADDING * 2
        this.mergeIndicator.rect(bx, by, bw, bh)
        this.mergeIndicator.fill({ color: 0x000000, alpha: 0.15 })
    }

    private drawMergePlus(stack: Card[]): void {
        const box = computeBoundingBox(stack)
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        const arm = 20
        const thickness = 5
        this.mergePlus.rect(cx - arm, cy - thickness / 2, arm * 2, thickness)
        this.mergePlus.fill({ color: 0x333333, alpha: 0.7 })
        this.mergePlus.rect(cx - thickness / 2, cy - arm, thickness, arm * 2)
        this.mergePlus.fill({ color: 0x333333, alpha: 0.7 })
    }
}
