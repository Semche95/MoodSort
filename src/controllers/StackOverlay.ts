import { Application, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import { computeBoundingBox } from '../utils/card'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT } from '../utils/constants'

/**
 * Manages all Graphics-based visual feedback for stacks:
 * hover highlight, drag border/handle, merge indicators.
 */
export class StackOverlay {
    private app: Application
    stackBorder: Graphics
    stackDragHandle: Graphics
    private mergeIndicator: Graphics
    private mergePlus: Graphics

    constructor(app: Application) {
        this.app = app
        this.stackBorder = new Graphics()
        this.stackDragHandle = new Graphics()
        this.mergeIndicator = new Graphics()
        this.mergePlus = new Graphics()
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
    }

    showHighlight(stack: Card[]): void {
        this.stackBorder.clear()
        this.stackDragHandle.clear()
        this.mergeIndicator.clear()
        this.mergePlus.clear()
        this.drawHighlight(stack)
    }

    showDragHighlights(
        draggedStack: Card[],
        mergeTargets: Card[][],
    ): void {
        this.stackBorder.clear()
        this.stackDragHandle.clear()
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
        }
        this.drawHighlight(draggedStack)
        this.app.stage.addChild(this.stackBorder)
        this.app.stage.addChild(this.stackDragHandle)
    }

    hide(): void {
        this.stackBorder.clear()
        this.stackDragHandle.clear()
        this.mergeIndicator.clear()
        this.mergePlus.clear()
    }

    restoreZOrder(): void {
        this.app.stage.addChildAt(this.stackBorder, 0)
        this.app.stage.addChildAt(this.stackDragHandle, 1)
    }

    private drawHighlight(stack: Card[]): void {
        const box = computeBoundingBox(stack)
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
