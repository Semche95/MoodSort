import { Application, Container, FederatedPointerEvent, Spritesheet } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { AnimationTarget } from '../types/animation.types'
import { CardManager } from '../features/card/card-manager'
import { DragHandler } from '../features/drag/drag-handler'
import { CardDrag } from '../features/drag/card-drag'
import { PositionPersistence } from '../features/card/position-persistence'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { StackDragManager } from '../features/stack/stack-drag-manager'
import { CardStateService } from '../features/card/card-state-service'
import { ActionHistory } from '../features/history/action-history'
import { IStore } from '../types/store.types'
import {
    computeStacks,
    findStackAtPoint,
    findStackByCompactButtonAtPoint,
    findStackByNameButtonAtPoint,
    findNameAnchor,
    computeLabelAnchorPoint,
    resolveNameSplits,
    resolveNameMerges,
} from '../features/stack/stack'
import { snapshotCards, applyHistoryEntry, applyStackNameChanges } from '../features/history/history'

export class CanvasScene {
    private app: Application
    private cardLayer: Container
    private cards: Card[]
    private cardManager: CardManager
    private dragHandler: DragHandler
    private positionPersistence: PositionPersistence
    private overlay: StackOverlay
    private stackDragManager: StackDragManager
    private actionHistory: ActionHistory
    private isCompacting: boolean
    private stacks: Card[][]
    private stackNames: Record<string, string>
    private onHistoryChange: () => void
    private onResize: () => void

    constructor(store: CardStateService, historyStore: IStore) {
        this.app = new Application()
        this.cardLayer = new Container()
        this.cardLayer.label = 'card-layer'
        this.cards = []
        this.stackNames = {}
        this.onHistoryChange = (): void => {}
        this.onResize = (): void => {}
        this.positionPersistence = new PositionPersistence(store)
        this.cardManager = new CardManager(this.app, this.cardLayer)
        this.actionHistory = new ActionHistory(historyStore, (): void => {
            this.onHistoryChange()
        })
        this.isCompacting = false
        this.dragHandler = new DragHandler(new CardDrag(), this.app, this.cardLayer, (): void => {
            this.recomputeStacks()
            this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        }, this.actionHistory)
        this.overlay = new StackOverlay(this.app, this.cardLayer, (): Record<string, string> => this.stackNames)
        this.stackDragManager = new StackDragManager(
            this.app,
            this.cardLayer,
            this.overlay,
            (): Card[][] => this.stacks,
            this.actionHistory,
        )
        this.stacks = []
        this.overlay.initHandle(this.handleDragHandlePointerDown)
        this.overlay.initCompactButton(this.handleCompactButtonPointerDown)
        this.overlay.initNameButton(this.handleNameButtonPointerDown)
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
        this.stackNames = saved.stackNames
        this.positionPersistence.save({
            positions: saved.positions,
            order: ordered,
            onboardingDismissed: saved.onboardingDismissed,
            stackNames: saved.stackNames,
        })

        this.cards = this.cardManager.loadCards(ordered, saved.positions, this.handleCardPointerDown, spritesheet)
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
        this.app.stage.on('pointerdown', this.handleStagePointerDown)
        window.addEventListener('resize', this.handleResize)
        document.body.appendChild(this.app.canvas)
    }

    get canUndo(): boolean {
        return this.actionHistory.canUndo
    }

    get canRedo(): boolean {
        return this.actionHistory.canRedo
    }

    private get isBusy(): boolean {
        return this.dragHandler.isDragging || this.stackDragManager.isDragging || this.isCompacting
    }

    /**
     * Recomputes `this.stacks` from current card positions and, comparing
     * against the stacks as they were just before, reassigns any name that a
     * split just orphaned (see resolveNameSplits), then fuses into one
     * string any two names that a merge just brought together (see
     * resolveNameMerges). Both are recorded as their own undo/redo entry,
     * separate from whatever caused the split/merge (a drag's own position
     * entry, if any), since neither was known until detected here.
     */
    private recomputeStacks(): void {
        const previousStacks = this.stacks
        const newStacks = computeStacks(this.cards)
        const splits = resolveNameSplits(previousStacks, newStacks, this.cardLayer, this.stackNames)
        const merges = resolveNameMerges(newStacks, this.cardLayer, this.stackNames)
        const before = { ...merges.before, ...splits.before }
        const after = { ...splits.after, ...merges.after }
        if (Object.keys(after).length > 0) {
            this.actionHistory.captureBefore([], before)
            this.actionHistory.recordAfter([], after)
        }
        this.stacks = newStacks
    }

    undo(): void {
        if (this.isBusy) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        const entry = this.actionHistory.undo()
        if (entry) {
            applyHistoryEntry(entry, this.cards, this.cardLayer, true)
            applyStackNameChanges(entry, this.stackNames, true)
        }
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.stacks = computeStacks(this.cards)
    }

    redo(): void {
        if (this.isBusy) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        const entry = this.actionHistory.redo()
        if (entry) {
            applyHistoryEntry(entry, this.cards, this.cardLayer, false)
            applyStackNameChanges(entry, this.stackNames, false)
        }
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.stacks = computeStacks(this.cards)
    }

    private handleStagePointerDown: () => void = (): void => {
        this.overlay.commitNameEditorIfOpen()
    }

    private handleCardPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.isCompacting) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        this.dragHandler.handleDragStart(e)
    }

    private handlePointerMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.dragHandler.isDragging) {
            this.overlay.hide()
            this.overlay.setHoveredStack(null)
            return
        }
        if (this.stackDragManager.isDragging) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackAtPoint(this.stacks, point)
        this.overlay.setHoveredStack(stack)
        if (stack) {
            this.overlay.showHighlight(stack)
            return
        }
        this.overlay.hide()
    }

    private handlePointerOut: () => void = (): void => {
        if (!this.stackDragManager.isDragging) {
            this.overlay.hide()
            this.overlay.setHoveredStack(null)
        }
    }

    private handleDragHandlePointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.dragHandler.isDragging || this.isCompacting) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackAtPoint(this.stacks, point)
        if (!stack) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        this.stackDragManager.startDrag(
            stack,
            stack,
            point,
        )
    }

    private handleCompactButtonPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.isBusy) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackByCompactButtonAtPoint(this.stacks, point)
        if (!stack) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        this.compactStack(stack)
    }

    private handleNameButtonPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        if (this.isBusy) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackByNameButtonAtPoint(this.stacks, point)
        if (!stack) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        const anchor = findNameAnchor(stack, this.cardLayer, this.stackNames)
        const currentName = this.stackNames[anchor.imageUrl] ?? null
        const labelPoint = computeLabelAnchorPoint(stack)
        this.actionHistory.captureBefore([], { [anchor.imageUrl]: currentName })
        this.overlay.openNameEditor(
            labelPoint.x,
            labelPoint.y,
            currentName ?? '',
            (value: string): void => this.commitStackName(anchor, value),
            (): void => this.cancelStackNameEdit(),
        )
    }

    private commitStackName(anchor: Card, value: string): void {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
            this.stackNames[anchor.imageUrl] = trimmed
        } else {
            delete this.stackNames[anchor.imageUrl]
        }
        this.actionHistory.recordAfter([], { [anchor.imageUrl]: trimmed.length > 0 ? trimmed : null })
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.stacks = computeStacks(this.cards)
    }

    private cancelStackNameEdit(): void {
        this.actionHistory.recordAfter([], {})
    }

    private compactStack(stack: Card[]): void {
        const topCard = stack.reduce(
            (top: Card, card: Card): Card =>
                this.cardLayer.children.indexOf(card) > this.cardLayer.children.indexOf(top) ? card : top,
        )
        const others = stack.filter((card: Card): boolean => card !== topCard)
        if (others.length === 0) {
            return
        }
        this.actionHistory.captureBefore(snapshotCards(others, this.cardLayer))
        const targets = this.cardManager.buildCompactTargets(topCard, others)
        this.isCompacting = true
        this.animateTargets(targets, 20, (): void => {
            this.actionHistory.recordAfter(snapshotCards(others, this.cardLayer))
            this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
            this.stacks = computeStacks(this.cards)
            this.isCompacting = false
        })
    }

    private handleStackDragEnd: () => void = (): void => {
        if (!this.stackDragManager.isDragging) {
            return
        }
        this.stackDragManager.end()
        this.recomputeStacks()
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
    }

    resetPositions(): void {
        if (this.isCompacting) {
            return
        }
        this.overlay.commitNameEditorIfOpen()
        this.actionHistory.clear()
        this.positionPersistence.clear()
        this.stackNames = {}
        const targets = this.cardManager.shuffleAndBuildTargets(this.cards)
        this.animateTargets(targets, 20, (): void => {
            this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
            this.stacks = computeStacks(this.cards)
        })
    }

    private animateTargets(targets: AnimationTarget[], duration: number, onComplete: () => void): void {
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
                onComplete()
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

        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.onResize()
    }
}
