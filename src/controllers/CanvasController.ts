import { Application } from 'pixi.js'
import { AnimationTarget, Card, CardState } from '../types/card.types'
import { CardManager } from './CardManager'
import { DragController } from './DragController'
import { DragHandler } from './DragHandler'
import { PositionPersistence } from './PositionPersistence'
import { CardStateService } from '../services/CardStateService'

/**
 * Orchestrates PixiJS app, cards, drag interactions, and persistence.
 */
export class CanvasController {
    private app: Application
    private cards: Card[]
    private cardManager: CardManager
    private dragHandler: DragHandler
    private positionPersistence: PositionPersistence

    constructor(store: CardStateService) {
        this.app = new Application()
        this.cards = []
        this.positionPersistence = new PositionPersistence(store)
        this.cardManager = new CardManager(this.app)
        this.dragHandler = new DragHandler(new DragController(), this.app, (): void => {
            this.positionPersistence.saveFromStage(this.app.stage)
        })
    }

    async init(images: string[]): Promise<void> {
        if (images.length === 0) {
            throw new Error('No images found')
        }

        await this.app.init({
            antialias: true,
            backgroundColor: '#a9a9a9',
        })
        this.app.renderer.resize(window.innerWidth, window.innerHeight)

        const saved: CardState = this.positionPersistence.load()
        const ordered: string[] = this.cardManager.resolveOrder(images, saved)
        this.positionPersistence.save({
            positions: saved.positions,
            order: ordered,
            onboardingDismissed: saved.onboardingDismissed,
        })

        this.cards = await this.cardManager.loadCards(ordered, saved.positions, this.dragHandler.handleDragStart)

        this.dragHandler.wireStageHandlers()
        window.addEventListener('resize', this.handleResize)
        document.body.appendChild(this.app.canvas)
    }

    resetPositions(): void {
        this.positionPersistence.clear()
        const targets: AnimationTarget[] = this.cardManager.shuffleAndBuildTargets(this.cards)
        this.animateToCenter(targets, 20)
    }

    private animateToCenter(targets: AnimationTarget[], duration: number): void {
        let elapsed: number = 0
        const tick: () => void = (): void => {
            elapsed++
            for (const t of targets) {
                const progress: number = Math.min(elapsed / duration, 1)
                const ease: number = 1 - Math.pow(1 - progress, 3)
                t.card.x = t.fromX + (t.toX - t.fromX) * ease
                t.card.y = t.fromY + (t.toY - t.fromY) * ease
            }
            if (elapsed >= duration) {
                this.app.ticker.remove(tick)
                this.positionPersistence.saveFromStage(this.app.stage)
            }
        }
        this.app.ticker.add(tick)
    }

    private handleResize: () => void = (): void => {
        const oldWidth: number = this.app.screen.width
        const oldHeight: number = this.app.screen.height

        this.app.renderer.resize(window.innerWidth, window.innerHeight)

        const newWidth: number = this.app.screen.width
        const newHeight: number = this.app.screen.height
        const ratioX: number = newWidth / oldWidth
        const ratioY: number = newHeight / oldHeight

        for (const card of this.cards) {
            this.cardManager.repositionForResize(card, ratioX, ratioY, newWidth, newHeight)
        }

        this.positionPersistence.saveFromStage(this.app.stage)
    }
}
