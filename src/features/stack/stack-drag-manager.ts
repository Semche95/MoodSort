import { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { StackOverlay } from './stack-overlay/stack-overlay'
import { computeGroupClampOffset } from './stack-geometry'
import { findMergeTargets } from './stack-merge'
import { ActionHistory } from '../history/action-history'
import { snapshotCards } from '../history/history'

/** Pixi only hit-tests on pointer events, so a still pointer keeps the target it had before the drop. */
function replayPointerMove(canvas: HTMLCanvasElement, client: Position): void {
    canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: client.x,
        clientY: client.y,
        pointerType: 'mouse',
        isPrimary: true,
        bubbles: true,
    }))
}

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
    private lastClient: Position | null
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
        this.lastClient = null
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
        this.lastClient = null
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
        // The resting grip is only redrawn under the pointer on the next frame, after the stacks are recomputed.
        const client = this.lastClient
        if (client) {
            this.app.ticker.addOnce((): void => replayPointerMove(this.app.canvas, client))
        }
    }

    private handleMove(e: FederatedPointerEvent): void {
        if (!this._isDragging) {
            return
        }
        this.lastClient = { x: e.client.x, y: e.client.y }
        const dx = e.global.x - this.startMouse.x
        const dy = e.global.y - this.startMouse.y
        for (const card of this._dragTarget) {
            const start = this.startPos.get(card)!
            card.x = start.x + dx
            card.y = start.y + dy
        }

        const offset = computeGroupClampOffset(this._dragTarget, this.app.screen.width, this.app.screen.height)
        if (offset.x !== 0 || offset.y !== 0) {
            for (const card of this._dragTarget) {
                card.x += offset.x
                card.y += offset.y
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
