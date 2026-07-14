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
            this.placeCard(card, savedPos)
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

        const duration: number = 20
        let elapsed: number = 0
        const starts: Array<{ card: Card; fromX: number; fromY: number; toX: number; toY: number }> = []

        for (const card of this.cards) {
            this.applyScale(card)
            const centerX: number = (this.app.screen.width - card.width) / 2
            const centerY: number = (this.app.screen.height - card.height) / 2
            const jitter: number = 25
            starts.push({
                card,
                fromX: card.x,
                fromY: card.y,
                toX: centerX + (Math.random() * 2 - 1) * jitter,
                toY: centerY + (Math.random() * 2 - 1) * jitter,
            })
        }

        const tick: () => void = (): void => {
            elapsed++
            for (const s of starts) {
                const t: number = Math.min(elapsed / duration, 1)
                const ease: number = 1 - Math.pow(1 - t, 3)
                s.card.x = s.fromX + (s.toX - s.fromX) * ease
                s.card.y = s.fromY + (s.toY - s.fromY) * ease
            }
            if (elapsed >= duration) {
                this.app.ticker.remove(tick)
                this.savePositions()
            }
        }

        this.app.ticker.add(tick)
    }

    private placeCard(card: Card, savedPos?: Position): void {
        if (savedPos) {
            card.x = savedPos.x
            card.y = savedPos.y
        } else {
            const centerX: number = (this.app.screen.width - card.width) / 2
            const centerY: number = (this.app.screen.height - card.height) / 2
            const jitter: number = 25
            card.x = centerX + (Math.random() * 2 - 1) * jitter
            card.y = centerY + (Math.random() * 2 - 1) * jitter
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
