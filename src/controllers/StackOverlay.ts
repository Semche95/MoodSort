import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import { computeBoundingBox } from '../utils/card'
import { computeStacks, findMergeTargets } from '../utils/stack'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT, DRAGGING_OPACITY } from '../utils/constants'

/**
 * Manages all Graphics-based visual feedback for stacks:
 * permanent border/handle, drag merge indicators.
 * The stack border and handle are redrawn every frame from the cards on the
 * stage, so they are permanently visible on every stack regardless of hover.
 */
export class StackOverlay {
    private app: Application
    stackBorder: Graphics
    stackDragHandle: Graphics
    private mergeIndicator: Graphics
    private mergePlus: Graphics
    private cards: Card[]
    private draggedCards: Card[]
    private restStacks: Map<Card, Card[]>
    private draggedSourceCards: Card[] | null
    private draggedSourceGeos: { x: number; y: number; width: number; height: number }[]

    constructor(app: Application) {
        this.app = app
        this.stackBorder = new Graphics()
        this.stackDragHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
        this.cards = []
        this.draggedCards = []
        this.restStacks = new Map()
        this.draggedSourceCards = null
        this.draggedSourceGeos = []
    }

    initHandle(onPointerDown: (e: FederatedPointerEvent) => void): void {
        this.stackBorder.eventMode = 'passive'
        this.stackDragHandle.eventMode = 'static'
        this.stackDragHandle.cursor = 'grab'
        this.stackDragHandle.on('pointerdown', onPointerDown)
    }

    addToStage(): void {
        this.app.stage.addChildAt(this.stackBorder, 0)
        this.app.stage.addChildAt(this.stackDragHandle, 1)
        this.app.stage.addChild(this.mergeIndicator)
        this.collectCards()
        this.app.ticker.add(this.render)
    }

    showHighlight(stack: Card[]): void {
        void stack
        this.mergeIndicator.clear()
        this.mergePlus.clear()
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
            this.app.stage.addChild(this.mergeIndicator)
            for (const card of draggedStack) {
                this.app.stage.addChild(card)
            }
            for (const target of mergeTargets) {
                this.drawMergePlus(target)
            }
            this.app.stage.addChild(this.mergePlus)
            this.app.stage.addChild(this.stackBorder)
            this.app.stage.addChild(this.stackDragHandle)
        }
    }

    hide(): void {
        this.mergeIndicator.clear()
        this.mergePlus.clear()
    }

    restoreZOrder(): void {
        this.draggedCards = []
        this.app.stage.addChildAt(this.stackBorder, 0)
        this.app.stage.addChildAt(this.stackDragHandle, 1)
    }

    private collectCards(): void {
        this.cards = this.app.stage.children.filter(
            (child: Container): child is Card => 'imageUrl' in child,
        )
    }

    private render: () => void = (): void => {
        this.stackBorder.clear()
        this.stackDragHandle.clear()

        const draggingCard = this.cards.find(
            (card: Card): boolean => card.alpha === DRAGGING_OPACITY,
        )
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
            this.drawSingleBox(box)
        }
        for (const stack of computeStacks(this.draggedCards)) {
            this.drawSingleStack(stack)
        }
        for (const stack of computeStacks(stackedCards)) {
            this.drawSingleStack(stack)
        }

        if (draggingCard) {
            this.drawSingleCardMergeIndicator(draggingCard)
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
            this.drawMergeTargetBorder(target)
            this.drawMergeDim(target)
        }
        this.app.stage.addChild(this.mergeIndicator)
        for (const target of mergeTargets) {
            this.drawMergePlus(target)
        }
        this.app.stage.addChild(this.mergePlus)
    }

    private drawSingleStack(stack: Card[]): void {
        this.drawSingleBox(computeBoundingBox(stack))
    }

    private drawSingleBox(box: { x: number; y: number; width: number; height: number }): void {
        const pad = STACK_HIGHLIGHT_PADDING
        const bx = box.x - pad
        const by = box.y - pad
        const bw = box.width + pad * 2
        const bh = box.height + pad * 2

        this.stackBorder.rect(bx, by, bw, bh)
        this.stackBorder.fill({ color: 0x000000, alpha: 0.001 })
        this.stackBorder.rect(bx, by, bw, bh)
        this.stackBorder.stroke({ color: 0x333333, width: 2, alpha: 0.6 })

        const handleWidth = Math.min(bw, 80)
        const hx = bx + (bw - handleWidth) / 2
        const hy = by - STACK_HANDLE_HEIGHT / 2

        this.stackDragHandle.roundRect(hx, hy, handleWidth, STACK_HANDLE_HEIGHT, 6)
        this.stackDragHandle.fill({ color: 0x444444, alpha: 0.75 })
        this.drawGripIcon(hx, hy, handleWidth)
    }

    private drawGripIcon(hx: number, hy: number, handleWidth: number): void {
        const cx = hx + handleWidth / 2
        const cy = hy + STACK_HANDLE_HEIGHT / 2
        const lineHalfWidth = 10
        const spacing = 4
        for (let i = -1; i <= 1; i++) {
            this.stackDragHandle.rect(cx - lineHalfWidth, cy + i * spacing - 1, lineHalfWidth * 2, 2)
            this.stackDragHandle.fill({ color: 0xaaaaaa, alpha: 0.9 })
        }
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
