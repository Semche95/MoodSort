import { Application, Container, FederatedPointerEvent, Spritesheet } from 'pixi.js'
import { Card } from '../types/card.types'
import { AnimationTarget } from '../types/animation.types'
import { ResolvedTheme } from '../types/theme.types'
import { ViewportSize } from '../types/viewport-size.types'
import { CardActionEntry } from '../types/history.types'
import type { Locale } from '../i18n/i18n.types'
import { loadCardAtlasSpritesheet } from '../i18n/card-atlas'
import type { ThemeService } from '../features/theme/theme-service'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { applyCanvasBackgroundTheme, createCanvasBackground, resizeCanvasBackground } from '../features/background/canvas-background'
import { CardManager } from '../features/card/card-manager'
import { DragHandler } from '../features/drag/drag-handler'
import { CardDrag } from '../features/drag/card-drag'
import { PositionPersistence } from '../features/card/position-persistence'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { StackDragManager } from '../features/stack/stack-drag-manager'
import { CardStateService } from '../features/card/card-state-service'
import { ActionHistory } from '../features/history/action-history'
import { IStore } from '../types/store.types'
import { computeStacks } from '../features/stack/stack'
import { applyStackShadowTheme, createStackShadow, drawStackShadow } from '../features/stack/stack-shadow'
import { shouldPlayDragHint, startDragHint } from '../features/onboarding/drag-hint'
import type { StackShadow } from '../types/stack-shadow.types'
import type { DragHint } from '../types/drag-hint.types'
import { getStackTop, resolveNameSplits, resolveNameMerges } from '../features/stack/stack-naming'
import { snapshotCards, applyHistoryEntry, applyStackNameChanges } from '../features/history/history'
import { createPointerInteractions } from '../features/interactions/pointer-interactions'
import type { PointerInteractions } from '../types/pointer-interactions.types'
import type { CanvasBackground } from '../types/canvas-background.types'

export class CanvasScene {
    private app: Application
    private cardLayer: Container
    private background: CanvasBackground | null = null
    private stackShadow: StackShadow
    private dragHint: DragHint | null = null
    private cards: Card[]
    private cardManager: CardManager
    private dragHandler: DragHandler
    private positionPersistence: PositionPersistence
    private overlay: StackOverlay
    private stackDragManager: StackDragManager
    private actionHistory: ActionHistory
    private pointerInteractions: PointerInteractions
    private isCompacting: boolean
    private stacks: Card[][]
    private stackNames: Record<string, string>
    private onHistoryChange: () => void
    private onResize: () => void
    private resolvedTheme: ResolvedTheme
    private locale: Locale

    constructor(store: CardStateService, historyStore: IStore, themeService?: ThemeService, locale: Locale = 'en') {
        this.app = new Application()
        this.cardLayer = new Container()
        this.cardLayer.label = 'card-layer'
        this.cards = []
        this.stackNames = {}
        this.onHistoryChange = (): void => {}
        this.onResize = (): void => {}
        this.resolvedTheme = themeService?.getResolvedTheme() ?? 'light'
        this.locale = locale
        this.stackShadow = createStackShadow(getPixiThemeColors(this.resolvedTheme).card.stackShadow)
        this.positionPersistence = new PositionPersistence(store, (): ViewportSize => this.viewport)
        this.cardManager = new CardManager(this.app, this.cardLayer)
        this.cardManager.setResolvedTheme(this.resolvedTheme)
        this.actionHistory = new ActionHistory(historyStore, (): void => {
            this.onHistoryChange()
        }, (): ViewportSize => this.viewport)
        this.isCompacting = false
        this.dragHandler = new DragHandler(new CardDrag(), this.app, this.cardLayer, (): void => {
            this.recomputeStacks()
            this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        }, this.actionHistory)
        this.overlay = new StackOverlay(
            this.app,
            this.cardLayer,
            (): Record<string, string> => this.stackNames,
            (): ResolvedTheme => this.resolvedTheme,
        )
        this.stackDragManager = new StackDragManager(
            this.app,
            this.cardLayer,
            this.overlay,
            (): Card[][] => this.stacks,
            this.actionHistory,
        )
        this.stacks = []
        this.pointerInteractions = createPointerInteractions({
            cardLayer: this.cardLayer,
            dragHandler: this.dragHandler,
            overlay: this.overlay,
            stackDragManager: this.stackDragManager,
            actionHistory: this.actionHistory,
            getStacks: (): Card[][] => this.stacks,
            getStackNames: (): Record<string, string> => this.stackNames,
            isBusy: (): boolean => this.isBusy,
            isCompacting: (): boolean => this.isCompacting,
            onCompactButton: (stack: Card[]): void => this.compactStack(stack),
            onCommitStackName: (anchor: Card, value: string): void => this.commitStackName(anchor, value),
            onCancelStackNameEdit: (): void => this.cancelStackNameEdit(),
        })
        this.overlay.initHandle(this.handleDragHandlePointerDown)
        this.overlay.initCompactButton(this.handleCompactButtonPointerDown)
        this.overlay.initNameButton(this.handleNameButtonPointerDown)
        themeService?.onChange((resolved: ResolvedTheme): void => {
            this.applyTheme(resolved)
            void this.swapCardAtlas(resolved)
        })
    }

    /** Single entry point for recoloring the scene on a theme change; card manager and overlay read the new theme lazily. */
    applyTheme(resolved: ResolvedTheme): void {
        this.resolvedTheme = resolved
        this.cardManager.setResolvedTheme(resolved)
        this.cardManager.updateShadows(this.cards)
        applyStackShadowTheme(this.stackShadow, getPixiThemeColors(resolved).card.stackShadow)
        const renderer = this.app.renderer as unknown as { background?: { color: number } } | undefined
        if (renderer?.background) {
            renderer.background.color = getPixiThemeColors(resolved).canvasBackground
        }
        if (this.background) {
            applyCanvasBackgroundTheme(this.background, resolved)
        }
    }

    /** Reloads the atlas for the current locale under `resolved` and swaps every card's texture, so a theme change updates card backgrounds/text without a page reload. */
    private async swapCardAtlas(resolved: ResolvedTheme): Promise<void> {
        const spritesheet = await loadCardAtlasSpritesheet(this.locale, resolved)
        this.cardManager.updateTextures(this.cards, spritesheet)
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

    get resolution(): number {
        return this.app.renderer.resolution
    }

    get screenWidth(): number {
        return this.app.screen.width
    }

    get screenHeight(): number {
        return this.app.screen.height
    }

    get canvasElement(): HTMLCanvasElement {
        return this.app.canvas
    }

    async init(frameNames: string[], spritesheet: Spritesheet): Promise<void> {
        if (frameNames.length === 0) {
            throw new Error('No images found')
        }

        await this.app.init({
            antialias: true,
            backgroundColor: getPixiThemeColors(this.resolvedTheme).canvasBackground,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        })
        this.applyTheme(this.resolvedTheme)
        this.app.renderer.resize(window.innerWidth, window.innerHeight)
        this.background = createCanvasBackground(this.app.renderer, this.app.screen.width, this.app.screen.height, this.resolvedTheme)
        this.app.stage.addChild(this.background.sprite)
        this.app.stage.addChild(this.stackShadow.graphics)
        this.app.stage.addChild(this.cardLayer)

        const saved = this.positionPersistence.load()
        const ordered = this.cardManager.resolveOrder(frameNames, saved)
        this.stackNames = saved.stackNames

        this.cards = this.cardManager.loadCards(ordered, saved.positions, saved.viewport, this.handleCardPointerDown, spritesheet)
        if (this.positionPersistence.wasMigrated) {
            this.actionHistory.clear()
        }
        this.stacks = computeStacks(this.cards)
        // Restoring into a differently sized window can clamp named stacks together; no history entry, since the user didn't act.
        resolveNameMerges(this.stacks, this.cardLayer, this.stackNames)
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)

        this.overlay.addToStage()
        this.dragHandler.wireStageHandlers()
        this.app.stage.on('pointermove', this.handlePointerMove)
        this.app.stage.on('pointerout', this.handlePointerOut)
        this.app.stage.on('pointerleave', this.handlePointerLeave)
        this.app.stage.on('pointerup', this.handleStackDragEnd)
        this.app.stage.on('pointerupoutside', this.handleStackDragEnd)
        this.app.stage.on('pointerdown', this.handleStagePointerDown)
        this.app.ticker.add(this.handleTick)
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
            this.applyHistory(entry, true)
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
            this.applyHistory(entry, false)
        }
        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.stacks = computeStacks(this.cards)
    }

    private get viewport(): ViewportSize {
        return { width: this.app.screen.width, height: this.app.screen.height }
    }

    /** The entry may predate a resize: cards it restores without an anchor are rescaled from its canvas size, then every stack is clamped. */
    private applyHistory(entry: CardActionEntry, reverse: boolean): void {
        const unanchored = applyHistoryEntry(entry, this.cards, this.cardLayer, reverse)
        this.cardManager.rescaleFromViewport(computeStacks(unanchored), entry.viewport ?? null)
        this.cardManager.rescaleFromViewport(computeStacks(this.cards), null)
        applyStackNameChanges(entry, this.stackNames, reverse)
    }

    /** Nudges the top card out of the pile to show cards can be moved; offered once, when a first-time visitor closes the onboarding. */
    offerDragHint(): void {
        this.dragHint?.stop()
        this.dragHint = shouldPlayDragHint()
            ? startDragHint(this.app.ticker, this.app.stage, getStackTop(this.cards, this.cardLayer))
            : null
    }

    private handleTick: () => void = (): void => {
        this.cardManager.updateLifts(this.cards, this.app.ticker.deltaTime)
        this.cardManager.updateHover(this.cards, this.pointerInteractions.findHoveredCard())
        drawStackShadow(this.stackShadow, this.cards)
    }

    private handleStagePointerDown: () => void = (): void => this.pointerInteractions.handleStagePointerDown()

    private handleCardPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void =>
        this.pointerInteractions.handleCardPointerDown(e)

    private handlePointerMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void =>
        this.pointerInteractions.handlePointerMove(e)

    private handlePointerOut: () => void = (): void => this.pointerInteractions.handlePointerOut()

    private handlePointerLeave: () => void = (): void => this.pointerInteractions.handlePointerLeave()

    private handleDragHandlePointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void =>
        this.pointerInteractions.handleDragHandlePointerDown(e)

    private handleCompactButtonPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void =>
        this.pointerInteractions.handleCompactButtonPointerDown(e)

    private handleNameButtonPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void =>
        this.pointerInteractions.handleNameButtonPointerDown(e)

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
        const topCard = getStackTop(stack, this.cardLayer)
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

        if (this.background) {
            resizeCanvasBackground(this.background, newWidth, newHeight)
        }

        this.cardManager.rescaleStacks(computeStacks(this.cards), ratioX, ratioY)
        // A drag or compact in progress resolves stacks itself when it ends, against the stacks it started from.
        if (!this.isBusy) {
            this.recomputeStacks()
        }

        this.positionPersistence.saveFromStage(this.cardLayer, this.stackNames)
        this.onResize()
    }
}
