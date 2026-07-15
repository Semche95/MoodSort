import { Application, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { DragController } from './DragController'
import { ActionHistory } from '../services/ActionHistory'

/**
 * Wires DragController to PixiJS stage events.
 * Owns the drag callback chain: start -> move -> end.
 */
export class DragHandler {
    private dragController: DragController
    private app: Application
    private onDragEnd: () => void
    private actionHistory: ActionHistory
    private lastDraggedCard: Card | null

    constructor(
        dragController: DragController,
        app: Application,
        onDragEnd: () => void,
        actionHistory: ActionHistory,
    ) {
        this.dragController = dragController
        this.app = app
        this.onDragEnd = onDragEnd
        this.actionHistory = actionHistory
        this.lastDraggedCard = null
    }

    get isDragging(): boolean {
        return this.dragController.dragState.dragTarget !== null
    }

    handleDragStart: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
        const card = event.currentTarget as Card
        this.lastDraggedCard = card
        this.actionHistory.captureBefore([card], this.app.stage)
        this.dragController.handleDragStart(event, this.app.stage, this.handleDragMove)
    }

    handleDragMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent) => {
        if (e.buttons === 0 && this.dragController.dragState.dragTarget) {
            this.handleDragEnd()
            return
        }
        this.dragController.handleDragMove(
            e,
            this.app.screen.width,
            this.app.screen.height,
        )
    }

    handleDragEnd: () => void = () => {
        this.dragController.handleDragEnd(
            this.app.stage,
            this.handleDragMove,
            this.app.screen.width,
            this.app.screen.height,
        )
        if (this.lastDraggedCard) {
            this.actionHistory.recordAfter([this.lastDraggedCard], this.app.stage)
            this.lastDraggedCard = null
        }
        this.onDragEnd()
    }

    wireStageHandlers(): void {
        this.app.stage.eventMode = 'static'
        this.app.stage.hitArea = this.app.screen
        this.app.stage.on('pointerup', this.handleDragEnd)
        this.app.stage.on('pointerupoutside', this.handleDragEnd)
    }
}
