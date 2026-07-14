import { Application, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { StackOverlay } from './StackOverlay'
import { findMergeTargets } from '../utils/stack'

/**
 * Manages the stack drag state machine: start, move, end.
 * Coordinates card reparenting, z-order preservation, and merge detection.
 */
export class StackDragManager {
    private app: Application
    private overlay: StackOverlay
    private getStacks: () => Card[][]
    private _isDragging: boolean
    private _dragTarget: Card[]
    private _sourceStack: Card[] | null
    private _mergeTargets: Card[][]
    private startPos: Map<Card, Position>
    private startMouse: Position
    private boundDragMove: (e: FederatedPointerEvent) => void

    constructor(app: Application, overlay: StackOverlay, getStacks: () => Card[][]) {
        this.app = app
        this.overlay = overlay
        this.getStacks = getStacks
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
                this.app.stage.children.indexOf(a) - this.app.stage.children.indexOf(b),
        )
        this.startMouse = { x: mousePos.x, y: mousePos.y }
        this.startPos = new Map()
        for (const card of this._dragTarget) {
            this.startPos.set(card, { x: card.x, y: card.y })
            this.app.stage.addChild(card)
        }
        this.app.stage.on('pointermove', this.boundDragMove)
    }

    end(): void {
        if (!this._isDragging) {
            return
        }
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
        const dx: number = e.global.x - this.startMouse.x
        const dy: number = e.global.y - this.startMouse.y
        for (const card of this._dragTarget) {
            const start: Position = this.startPos.get(card)!
            card.x = start.x + dx
            card.y = start.y + dy
        }
        this._mergeTargets = findMergeTargets(
            this._dragTarget,
            this.getStacks(),
            this._sourceStack,
        )
        this.overlay.showDragHighlights(this._dragTarget, this._mergeTargets)
    }
}
