import { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../../types/card.types'
import { CardDrag } from './card-drag'
import { ActionHistory } from '../history/action-history'
import { snapshotCards } from '../history/history'

/**
 * Only moves the dragged card and records its own before/after position in
 * history; never touches stackNames itself. A drag can still end up causing
 * a name to change owner (e.g. dragging a card off a named pile), but that's
 * detected and recorded separately by whatever runs after onDragEnd, once
 * the resulting stacks are known.
 */
export class DragHandler {
    private cardDrag: CardDrag
    private app: Application
    private cardLayer: Container
    private onDragEnd: () => void
    private actionHistory: ActionHistory
    private lastDraggedCard: Card | null

    constructor(
        cardDrag: CardDrag,
        app: Application,
        cardLayer: Container,
        onDragEnd: () => void,
        actionHistory: ActionHistory,
    ) {
        this.cardDrag = cardDrag
        this.app = app
        this.cardLayer = cardLayer
        this.onDragEnd = onDragEnd
        this.actionHistory = actionHistory
        this.lastDraggedCard = null
    }

    get isDragging(): boolean {
        return this.cardDrag.dragState.dragTarget !== null
    }

    handleDragStart: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
        const card = event.currentTarget as Card
        this.lastDraggedCard = card
        this.actionHistory.captureBefore(snapshotCards([card], this.cardLayer))
        this.cardDrag.handleDragStart(event, this.app.stage, this.cardLayer, this.handleDragMove)
    }

    handleDragMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent) => {
        if (e.buttons === 0 && this.cardDrag.dragState.dragTarget) {
            this.handleDragEnd()
            return
        }
        this.cardDrag.handleDragMove(
            e,
            this.app.screen.width,
            this.app.screen.height,
        )
    }

    handleDragEnd: () => void = () => {
        this.cardDrag.handleDragEnd(
            this.app.stage,
            this.handleDragMove,
            this.app.screen.width,
            this.app.screen.height,
        )
        if (this.lastDraggedCard) {
            const card = this.lastDraggedCard
            this.actionHistory.recordAfter(snapshotCards([card], this.cardLayer))
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
