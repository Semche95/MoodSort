import { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { StackOverlay } from './stack-overlay/stack-overlay'
import { computeBoundingBox, findMergeTargets, STACK_HANDLE_TOP_CLEARANCE } from './stack'
import { ActionHistory } from '../history/action-history'
import { snapshotCards } from '../history/history'

export class StackDragManager {
    private app: Application
    private cardLayer: Container
    private overlay: StackOverlay
    private getStacks: () => Card[][]
    private actionHistory: ActionHistory
    private _isDragging: boolean
    private _dragTarget: Card[]
    private _sourceStack: Card[] | null
    private _mergeTargets: Card[][]
    private startPos: Map<Card, Position>
    private startMouse: Position
    private boundDragMove: (e: FederatedPointerEvent) => void

    constructor(
        app: Application,
        cardLayer: Container,
        overlay: StackOverlay,
        getStacks: () => Card[][],
        actionHistory: ActionHistory,
    ) {
        this.app = app
        this.cardLayer = cardLayer
        this.overlay = overlay
        this.getStacks = getStacks
        this.actionHistory = actionHistory
        this._isDragging = false
        this._dragTarget = []
        this._sourceStack = null
        this._mergeTargets = []
        this.startPos = new Map()
        this.startMouse = { x: 0, y: 0 }
        this.boundDragMove = (e: FederatedPointerEvent): void => this.handleMove(e)
    }

    get isDragging(): boolean {
        return this._isDragging
    }

    get dragTarget(): Card[] {
        return this._dragTarget
    }

    get mergeTargets(): Card[][] {
        return this._mergeTargets
    }

    startDrag(
        stack: Card[],
        sourceStack: Card[] | null,
        mousePos: Position,
    ): void {
        this._isDragging = true
        this._sourceStack = sourceStack
        this._dragTarget = [...stack].sort(
            (a: Card, b: Card): number =>
                this.cardLayer.children.indexOf(a) - this.cardLayer.children.indexOf(b),
        )
        this.actionHistory.captureBefore(snapshotCards(this._dragTarget, this.cardLayer))
        this.startMouse = { x: mousePos.x, y: mousePos.y }
        this.startPos = new Map()
        for (const card of this._dragTarget) {
            this.startPos.set(card, { x: card.x, y: card.y })
            this.cardLayer.addChild(card)
        }
        this.app.stage.on('pointermove', this.boundDragMove)
    }

    end(): void {
        if (!this._isDragging) {
            return
        }
        this.actionHistory.recordAfter(snapshotCards(this._dragTarget, this.cardLayer))
        this._isDragging = false
        this._dragTarget = []
        this._sourceStack = null
        this._mergeTargets = []
        this.startPos.clear()
        this.app.stage.off('pointermove', this.boundDragMove)
        this.overlay.restoreZOrder()
    }

    private handleMove(e: FederatedPointerEvent): void {
        if (!this._isDragging) {
            return
        }
        const dx = e.global.x - this.startMouse.x
        const dy = e.global.y - this.startMouse.y
        for (const card of this._dragTarget) {
            const start = this.startPos.get(card)!
            card.x = start.x + dx
            card.y = start.y + dy
        }

        // The whole group moves as one rigid block, so clamping is done once
        // against the group's bounding box (not per-card) to keep it fitted
        // together. STACK_HANDLE_TOP_CLEARANCE keeps the drag handle itself
        // (drawn above the box) fully on-canvas.
        const box = computeBoundingBox(this._dragTarget)
        const appWidth = this.app.screen.width
        const appHeight = this.app.screen.height
        let adjustX = 0
        let adjustY = 0
        if (box.x < 0) {
            adjustX = -box.x
        } else if (box.x + box.width > appWidth) {
            adjustX = appWidth - (box.x + box.width)
        }
        if (box.y < STACK_HANDLE_TOP_CLEARANCE) {
            adjustY = STACK_HANDLE_TOP_CLEARANCE - box.y
        } else if (box.y + box.height > appHeight) {
            adjustY = appHeight - (box.y + box.height)
        }
        if (adjustX !== 0 || adjustY !== 0) {
            for (const card of this._dragTarget) {
                card.x += adjustX
                card.y += adjustY
            }
        }

        this._mergeTargets = findMergeTargets(
            this._dragTarget,
            this.getStacks(),
            this._sourceStack,
        )
        this.overlay.showDragHighlights(this._dragTarget, this._mergeTargets)
    }
}
