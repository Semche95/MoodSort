import { Application, FederatedPointerEvent } from 'pixi.js'
import { DragController } from './DragController'

/**
 * Wires DragController to PixiJS stage events.
 * Owns the drag callback chain: start → move → end.
 */
export class DragHandler {
    private dragController: DragController
    private app: Application
    private onDragEnd: () => void

    constructor(dragController: DragController, app: Application, onDragEnd: () => void) {
        this.dragController = dragController
        this.app = app
        this.onDragEnd = onDragEnd
    }

    handleDragStart: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
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
        this.onDragEnd()
    }

    wireStageHandlers(): void {
        this.app.stage.eventMode = 'static'
        this.app.stage.hitArea = this.app.screen
        this.app.stage.on('pointerup', this.handleDragEnd)
        this.app.stage.on('pointerupoutside', this.handleDragEnd)
    }
}
