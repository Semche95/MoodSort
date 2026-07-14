import { Application, FederatedPointerEvent } from 'pixi.js'
import { AnimationTarget, Card, CardState } from '../types/card.types'
import { Position } from '../types/position.types'
import { CardManager } from './CardManager'
import { DragHandler } from './DragHandler'
import { DragController } from './DragController'
import { PositionPersistence } from './PositionPersistence'
import { StackOverlay } from './StackOverlay'
import { StackDragManager } from './StackDragManager'
import { CardStateService } from '../services/CardStateService'
import { ActionHistory } from '../services/ActionHistory'
import { IStore } from '../services/Store'
import { computeStacks, findStackAtPoint } from '../utils/stack'

/**
 * Orchestrates PixiJS app, cards, drag interactions, and persistence.
 */
export class CanvasController {
    private app: Application
    private cards: Card[]
    private cardManager: CardManager
    private dragHandler: DragHandler
    private positionPersistence: PositionPersistence
    private overlay: StackOverlay
    private stackDragManager: StackDragManager
    private actionHistory: ActionHistory
    private stacks: Card[][]
    private onHistoryChange: () => void

    constructor(store: CardStateService, historyStore: IStore) {
        this.app = new Application()
        this.cards = []
        this.onHistoryChange = (): void => { /* set by initToolbar */ }
        this.positionPersistence = new PositionPersistence(store)
        this.cardManager = new CardManager(this.app)
        this.actionHistory = new ActionHistory(historyStore, (): void => {
            this.onHistoryChange()
        })
        this.dragHandler = new DragHandler(new DragController(), this.app, (): void => {
            this.positionPersistence.saveFromStage(this.app.stage)
            this.stacks = computeStacks(this.cards)
        }, this.actionHistory)
        this.overlay = new StackOverlay(this.app)
        this.stackDragManager = new StackDragManager(
            this.app,
            this.overlay,
            (): Card[][] => this.stacks,
            this.actionHistory,
        )
        this.stacks = []
        this.overlay.initHandle(this.handleDragHandlePointerDown)
    }

    setOnHistoryChange(callback: () => void): void {
        this.onHistoryChange = callback
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
        this.stacks = computeStacks(this.cards)

        this.overlay.addToStage()
        this.dragHandler.wireStageHandlers()
        this.app.stage.on('pointermove', this.handlePointerMove)
        this.app.stage.on('pointerout', this.handlePointerOut)
        this.app.stage.on('pointerup', this.handleStackDragEnd)
        this.app.stage.on('pointerupoutside', this.handleStackDragEnd)
        window.addEventListener('resize', this.handleResize)
        document.body.appendChild(this.app.canvas)
    }

    get canUndo(): boolean {
        return this.actionHistory.canUndo
    }

    get canRedo(): boolean {
        return this.actionHistory.canRedo
    }

    undo(): void {
        if (this.dragHandler.isDragging || this.stackDragManager.isDragging) {
            return
        }
        this.actionHistory.undo(this.cards, this.app.stage)
        this.positionPersistence.saveFromStage(this.app.stage)
        this.stacks = computeStacks(this.cards)
    }

    redo(): void {
        if (this.dragHandler.isDragging || this.stackDragManager.isDragging) {
            return
        }
        this.actionHistory.redo(this.cards, this.app.stage)
        this.positionPersistence.saveFromStage(this.app.stage)
        this.stacks = computeStacks(this.cards)
    }

    private handlePointerMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.dragHandler.isDragging) {
            this.overlay.hide()
            return
        }
        if (this.stackDragManager.isDragging) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack: Card[] | null = findStackAtPoint(this.stacks, point)
        if (stack) {
            this.overlay.showHighlight(stack)
            return
        }
        this.overlay.hide()
    }

    private handlePointerOut: () => void = (): void => {
        if (!this.stackDragManager.isDragging) {
            this.overlay.hide()
        }
    }

    private handleDragHandlePointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.dragHandler.isDragging) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack: Card[] | null = findStackAtPoint(this.stacks, point)
        if (!stack) {
            return
        }
        this.stackDragManager.startDrag(
            stack,
            stack,
            point,
        )
    }

    private handleStackDragEnd: () => void = (): void => {
        if (!this.stackDragManager.isDragging) {
            return
        }
        this.stackDragManager.end()
        this.positionPersistence.saveFromStage(this.app.stage)
        this.stacks = computeStacks(this.cards)
    }

    resetPositions(): void {
        this.actionHistory.clear()
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
                this.stacks = computeStacks(this.cards)
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
