import { Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { CardDragState } from '../types/drag.types'
import { Position } from '../types/position.types'
import { constrainPosition } from '../utils/geometry'
import { DEFAULT_OPACITY, DRAGGING_OPACITY } from '../utils/constants'

/** Decoupled from the PixiJS Application for testability. */
export class DragController {
    dragState: CardDragState

    constructor() {
        this.dragState = {
            dragTarget: null,
            dragOffset: { x: 0, y: 0 },
            originalParent: null,
            originalPosition: { x: 0, y: 0 },
            cardMoved: false,
        }
    }

    handleDragStart(
        event: FederatedPointerEvent,
        stage: Container,
        cardLayer: Container,
        onDragMove: (event: FederatedPointerEvent) => void,
    ): void {
        const target = event.currentTarget as Card
        target.alpha = DRAGGING_OPACITY
        this.dragState.dragTarget = target
        this.dragState.cardMoved = false

        this.dragState.originalParent = target.parent as Container
        this.dragState.originalPosition.x = target.x
        this.dragState.originalPosition.y = target.y

        const globalPosition: Position = target.getGlobalPosition()

        this.dragState.dragOffset.x = globalPosition.x - event.global.x
        this.dragState.dragOffset.y = globalPosition.y - event.global.y

        const parent = target.parent
        if (parent) {
            parent.removeChild(target)
        }

        cardLayer.addChild(target)
        target.position.set(globalPosition.x, globalPosition.y)

        stage.on('pointermove', onDragMove)
    }

    handleDragMove(
        event: FederatedPointerEvent,
        appWidth: number,
        appHeight: number,
    ): void {
        if (!this.dragState.dragTarget) {
            return
        }

        this.dragState.cardMoved = true

        const newGlobalX = event.global.x + this.dragState.dragOffset.x
        const newGlobalY = event.global.y + this.dragState.dragOffset.y

        const constrained = constrainPosition(
            newGlobalX,
            newGlobalY,
            this.dragState.dragTarget.width,
            this.dragState.dragTarget.height,
            appWidth,
            appHeight,
        )

        this.dragState.dragTarget.position.set(constrained.x, constrained.y)
    }

    handleDragEnd(
        stage: Container,
        onDragMove: (event: FederatedPointerEvent) => void,
        appWidth: number,
        appHeight: number,
    ): void {
        if (!this.dragState.dragTarget) {
            return
        }

        stage.off('pointermove', onDragMove)

        const card = this.dragState.dragTarget
        card.alpha = DEFAULT_OPACITY

        if (!this.dragState.cardMoved) {
            const currentParent = card.parent
            if (currentParent) {
                currentParent.removeChild(card)
            }

            if (this.dragState.originalParent) {
                this.dragState.originalParent.addChild(card)
            }

            card.x = this.dragState.originalPosition.x
            card.y = this.dragState.originalPosition.y
        }

        const constrained = constrainPosition(
            card.x,
            card.y,
            card.width,
            card.height,
            appWidth,
            appHeight,
        )
        card.x = constrained.x
        card.y = constrained.y

        this.resetDragState()
    }

    private resetDragState(): void {
        this.dragState.dragTarget = null
        this.dragState.originalParent = null
        this.dragState.originalPosition.x = 0
        this.dragState.originalPosition.y = 0
        this.dragState.cardMoved = false
    }
}
