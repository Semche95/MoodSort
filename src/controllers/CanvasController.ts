import { Application, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { constrainPosition, createCard } from '../utils/card'
import { CARD_REFERENCE_WIDTH } from '../utils/constants'
import { DragController } from './DragController'
import { IPositionStore } from '../services/PositionStore'

/**
 * CanvasController manages the PixiJS app, card loading, and wires DragController + PositionStore.
 */
export class CanvasController {
    app: Application
    cards: Card[]
    dragController: DragController
    private positionStore: IPositionStore

    constructor(positionStore: IPositionStore) {
        this.app = new Application()
        this.cards = []
        this.dragController = new DragController()
        this.positionStore = positionStore
    }

    async init(images: string[]): Promise<void> {
        if (images.length === 0) {
            throw new Error('No images found')
        }

        await this.app.init({
            antialias: true,
            backgroundColor: '#a9a9a9',
        })

        this.resizeCanvas()

        const saved: Record<string, Position> = this.positionStore.load()

        for (let i: number = 0; i < images.length; i++) {
            const card: Card = await createCard(images[i], this.handleCardDragStart)
            this.applyScale(card)
            this.cards.push(card)

            const savedPos: Position | undefined = saved[images[i]]
            if (savedPos) {
                card.x = savedPos.x
                card.y = savedPos.y
            } else {
                const centerX: number = (this.app.screen.width - card.width) / 2
                const centerY: number = (this.app.screen.height - card.height) / 2
                card.x = centerX
                card.y = centerY
            }

            this.app.stage.addChild(card)
        }

        this.wireStageHandlers()
        window.addEventListener('resize', this.handleResize)
        document.body.appendChild(this.app.canvas)
    }

    handleCardDragStart: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
        this.dragController.handleDragStart(event, this.app.stage, this.handleCardDragMove)
    }

    handleCardDragMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent) => {
        if (e.buttons === 0 && this.dragController.dragState.dragTarget) {
            this.handleCardDragEnd()
            return
        }
        this.dragController.handleDragMove(
            e,
            this.app.screen.width,
            this.app.screen.height,
        )
    }

    handleCardDragEnd: () => void = () => {
        this.dragController.handleDragEnd(
            this.app.stage,
            this.handleCardDragMove,
            this.app.screen.width,
            this.app.screen.height,
        )
        this.savePositions()
    }

    wireStageHandlers(): void {
        this.app.stage.eventMode = 'static'
        this.app.stage.hitArea = this.app.screen
        this.app.stage.on('pointerup', this.handleCardDragEnd)
        this.app.stage.on('pointerupoutside', this.handleCardDragEnd)
    }

    private savePositions(): void {
        const positions: Record<string, Position> = {}
        for (const card of this.cards) {
            positions[card.imageUrl] = { x: card.x, y: card.y }
        }
        this.positionStore.save(positions)
    }

    resetPositions(): void {
        this.positionStore.clear()
        for (const card of this.cards) {
            this.applyScale(card)
            const centerX: number = (this.app.screen.width - card.width) / 2
            const centerY: number = (this.app.screen.height - card.height) / 2
            card.x = centerX
            card.y = centerY
        }
    }

    private applyScale(card: Card): void {
        const cardScale: number = this.app.screen.width / CARD_REFERENCE_WIDTH
        card.scale.set(cardScale)
    }

    private resizeCanvas(): void {
        this.app.renderer.resize(window.innerWidth, window.innerHeight)
    }

    handleResize: () => void = (): void => {
        const oldWidth: number = this.app.screen.width
        const oldHeight: number = this.app.screen.height

        this.resizeCanvas()

        const newWidth: number = this.app.screen.width
        const newHeight: number = this.app.screen.height
        const ratioX: number = newWidth / oldWidth
        const ratioY: number = newHeight / oldHeight

        for (const card of this.cards) {
            this.applyScale(card)

            card.x = card.x * ratioX
            card.y = card.y * ratioY

            const constrained: Position = constrainPosition(
                card.x,
                card.y,
                card.width,
                card.height,
                newWidth,
                newHeight,
            )
            card.x = constrained.x
            card.y = constrained.y
        }

        this.savePositions()
    }
}
