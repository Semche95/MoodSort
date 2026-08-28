import { Application, Container, FederatedPointerEvent, Spritesheet } from 'pixi.js'
import { AnimationTarget, Card } from '../types/card.types'
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
    private cardLayer: Container
    private cards: Card[]
    private cardManager: CardManager
    private dragHandler: DragHandler
    private positionPersistence: PositionPersistence
    private overlay: StackOverlay
    private stackDragManager: StackDragManager
    private actionHistory: ActionHistory
    private stacks: Card[][]
    private onHistoryChange: () => void
    private onResize: () => void

    constructor(store: CardStateService, historyStore: IStore) {
        this.app = new Application()
        this.cardLayer = new Container()
        this.cardLayer.label = 'card-layer'
        this.cards = []
        this.onHistoryChange = (): void => {}
        this.onResize = (): void => {}
        this.positionPersistence = new PositionPersistence(store)
        this.cardManager = new CardManager(this.app, this.cardLayer)
        this.actionHistory = new ActionHistory(historyStore, (): void => {
            this.onHistoryChange()
        })
        this.dragHandler = new DragHandler(new DragController(), this.app, this.cardLayer, (): void => {
            this.positionPersistence.saveFromStage(this.cardLayer)
            this.stacks = computeStacks(this.cards)
        }, this.actionHistory)
        this.overlay = new StackOverlay(this.app, this.cardLayer)
        this.stackDragManager = new StackDragManager(
            this.app,
            this.cardLayer,
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

    registerOnResize(callback: () => void): void {
        this.onResize = callback
    }

    get stage(): Container {
        return this.app.stage
    }

    get screenWidth(): number {
        return this.app.screen.width
    }

    get screenHeight(): number {
        return this.app.screen.height
    }

    async init(frameNames: string[], spritesheet: Spritesheet): Promise<void> {
        if (frameNames.length === 0) {
            throw new Error('No images found')
        }

        await this.app.init({
            antialias: true,
            backgroundColor: '#a9a9a9',
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        })
        this.app.renderer.resize(window.innerWidth, window.innerHeight)
        this.app.stage.addChild(this.cardLayer)

        const saved = this.positionPersistence.load()
        const ordered = this.cardManager.resolveOrder(frameNames, saved)
        this.positionPersistence.save({
            positions: saved.positions,
            order: ordered,
            onboardingDismissed: saved.onboardingDismissed,
        })

        this.cards = this.cardManager.loadCards(ordered, saved.positions, this.dragHandler.handleDragStart, spritesheet)
        if (this.positionPersistence.wasMigrated) {
            this.actionHistory.clear()
        }
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
        this.actionHistory.undo(this.cards, this.cardLayer)
        this.positionPersistence.saveFromStage(this.cardLayer)
        this.stacks = computeStacks(this.cards)
    }

    redo(): void {
        if (this.dragHandler.isDragging || this.stackDragManager.isDragging) {
            return
        }
        this.actionHistory.redo(this.cards, this.cardLayer)
        this.positionPersistence.saveFromStage(this.cardLayer)
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
        const stack = findStackAtPoint(this.stacks, point)
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
        const stack = findStackAtPoint(this.stacks, point)
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
        this.positionPersistence.saveFromStage(this.cardLayer)
        this.stacks = computeStacks(this.cards)
    }

    resetPositions(): void {
        this.actionHistory.clear()
        this.positionPersistence.clear()
        const targets = this.cardManager.shuffleAndBuildTargets(this.cards)
        this.animateToCenter(targets, 20)
    }

    private animateToCenter(targets: AnimationTarget[], duration: number): void {
        let elapsed = 0
        const tick = (): void => {
            elapsed++
            for (const t of targets) {
                const progress = Math.min(elapsed / duration, 1)
                const ease = 1 - Math.pow(1 - progress, 3)
                t.card.x = t.fromX + (t.toX - t.fromX) * ease
                t.card.y = t.fromY + (t.toY - t.fromY) * ease
            }
            if (elapsed >= duration) {
                this.app.ticker.remove(tick)
                this.positionPersistence.saveFromStage(this.cardLayer)
                this.stacks = computeStacks(this.cards)
            }
        }
        this.app.ticker.add(tick)
    }

    private handleResize: () => void = (): void => {
        const oldWidth = this.app.screen.width
        const oldHeight = this.app.screen.height

        this.app.renderer.resize(window.innerWidth, window.innerHeight)

        const newWidth = this.app.screen.width
        const newHeight = this.app.screen.height
        const ratioX = newWidth / oldWidth
        const ratioY = newHeight / oldHeight

        for (const card of this.cards) {
            this.cardManager.repositionForResize(card, ratioX, ratioY, newWidth, newHeight)
        }

        this.positionPersistence.saveFromStage(this.cardLayer)
        this.onResize()
    }
}
