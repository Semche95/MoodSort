import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Container, Spritesheet } from 'pixi.js'
import { CanvasScene } from '../app/canvas-scene'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'
import { applyCanvasBackgroundTheme, createCanvasBackground, resizeCanvasBackground } from '../features/background/canvas-background'
import { startDragHint } from '../features/onboarding/drag-hint'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import type { StackShadow } from '../types/stack-shadow.types'
import { CardState } from '../types/card-state.types'
import { HistoryData, HISTORY_KEY } from '../types/history.types'
import { ActionHistory } from '../features/history/action-history'
import { snapshotCards } from '../features/history/history'
import { STACK_FRAME_CLEARANCE } from '../features/stack/stack'

const { mockSpritesheet } = vi.hoisted(() => {
    const mockTexture = { width: 200, height: 300 }
    return {
        mockSpritesheet: {
            textures: {
                'card-a': mockTexture,
                'card-b': mockTexture,
            },
        },
    }
})

vi.mock('../i18n/card-atlas', () => ({
    loadCardAtlasSpritesheet: vi.fn().mockResolvedValue(mockSpritesheet),
}))

vi.mock('../features/background/canvas-background', () => ({
    createCanvasBackground: vi.fn(() => ({ sprite: { label: 'canvas-background' } })),
    resizeCanvasBackground: vi.fn(),
    applyCanvasBackgroundTheme: vi.fn(),
}))

vi.mock('../features/onboarding/drag-hint', async (importOriginal: () => Promise<Record<string, unknown>>) => ({
    ...(await importOriginal()),
    startDragHint: vi.fn(),
}))

vi.mock('pixi.js', () => {
    const tickers: Array<() => void> = []
    const mockApp: Record<string, unknown> = {
        stage: undefined,
        screen: { width: 800, height: 600 },
        renderer: {
            resize: vi.fn((w: number, h: number): void => {
                (mockApp.screen as { width: number; height: number }).width = w
                ;(mockApp.screen as { width: number; height: number }).height = h
            }),
            background: { color: 0 },
            resolution: 2,
        },
        ticker: {
            deltaTime: 1,
            deltaMS: 16,
            add: (fn: () => void): void => {
                tickers.push(fn)
            },
            remove: (fn: () => void): void => {
                const index = tickers.indexOf(fn)
                if (index !== -1) tickers.splice(index, 1)
            },
        },
        init: vi.fn().mockResolvedValue(undefined),
        canvas: document.createElement('canvas'),
        __tick: (): void => {
            for (const fn of [...tickers]) fn()
        },
    }

    class MockContainer {
        children: unknown[] = []
        x: number = 0
        y: number = 0
        width: number = 200
        height: number = 300
        alpha: number = 1
        eventMode: string = 'auto'
        cursor: string = 'default'
        hitArea: unknown = null
        label: string = ''
        scale: { x: number; y: number; set(v: number): void } = {
            x: 1,
            y: 1,
            set: vi.fn(function set(this: { x: number; y: number }, v: number): void { this.x = v; this.y = v }),
        }
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        on(): this { return this }
        off(): this { return this }
        addChild(child: unknown): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.push(child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        addChildAt(child: unknown, index: number): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.splice(index, 0, child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        removeChild(child: unknown): unknown {
            const index = this.children.indexOf(child)
            if (index !== -1) {
                this.children.splice(index, 1);
                (child as Record<string, unknown>).parent = null
            }
            return child
        }
    }

    mockApp.stage = new MockContainer()

    class MockGraphics extends MockContainer {
        roundRect(): this { return this }
        moveTo(): this { return this }
        lineTo(): this { return this }
        closePath(): this { return this }
        circle(): this { return this }
        rect(): this { return this }
        fill(): this { return this }
        stroke(): this { return this }
        clear(): this { return this }
        filters: unknown[] = []
    }

    class MockSprite extends MockContainer {
        constructor(texture: Record<string, unknown>) {
            super()
            this.texture = texture
        }
        texture: unknown = null
        innerSprite: unknown = null
        imageUrl: string = ''
        tint: number = 0xffffff
        getGlobalPosition: () => { x: number; y: number } = vi.fn().mockReturnValue({ x: 0, y: 0 })
    }

    class MockText extends MockContainer {
        text: string
        style: Record<string, unknown>
        anchor: { set(x: number, y: number): void } = { set: vi.fn() }
        constructor(options: { text?: string; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text ?? ''
            this.style = options.style ?? {}
        }
    }

    return {
        Application: vi.fn(function MockApplication() { return mockApp }),
        Container: MockContainer,
        Graphics: MockGraphics,
        Sprite: MockSprite,
        Text: MockText,
        BlurFilter: class MockBlurFilter { constructor() {} },
        AlphaFilter: class MockAlphaFilter { alpha: number = 1 },
        Rectangle: class MockRectangle {},
        FederatedPointerEvent: class MockFederatedPointerEvent {},
        __getMockApp: (): Record<string, unknown> => mockApp,
    }
})

async function importMockedPixi(): Promise<{ __getMockApp: () => Record<string, unknown> & { __tick: () => void } }> {
    return (await import('pixi.js')) as unknown as { __getMockApp: () => Record<string, unknown> & { __tick: () => void } }
}

interface TestableScene {
    cards: Card[]
    stackShadow: StackShadow
    cardLayer: { children: unknown[] }
    app: { stage: { children: unknown[] }; renderer: unknown }
}

function seedStore(): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({
        positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 400, y: 100 } },
        order: ['card-a', 'card-b'],
        onboardingDismissed: false,
        stackNames: {},
        viewport: null,
    })
    return store
}

describe('CanvasScene', () => {
    let historyStore: InMemoryStore

    beforeEach(() => {
        vi.clearAllMocks()
        historyStore = new InMemoryStore()
    })

    afterEach(() => {
        document.body.innerHTML = ''
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 })
    })

    async function setup(): Promise<{
        scene: CanvasScene
        testable: TestableScene
        tick: () => void
    }> {
        const store = seedStore()
        const scene = new CanvasScene(store, historyStore)
        await scene.init(['card-a', 'card-b'], mockSpritesheet as unknown as Spritesheet)
        const pixi = await importMockedPixi()
        const tick = (): void => pixi.__getMockApp().__tick()
        return { scene, testable: scene as unknown as TestableScene, tick }
    }

    it('throws when there are no images to load', async () => {
        const store = seedStore()
        const scene = new CanvasScene(store, historyStore)

        await expect(scene.init([], mockSpritesheet as unknown as Spritesheet)).rejects.toThrow('No images found')
    })

    it('wires the card layer onto the stage, loads every card, and mounts the canvas in the document', async () => {
        const { scene, testable } = await setup()

        expect(testable.app.stage.children).toContain(testable.cardLayer)
        expect(testable.cards.map((c: Card): string => c.imageUrl)).toEqual(['card-a', 'card-b'])
        expect(scene.stage).toBe(testable.app.stage)
        expect(document.body.querySelector('canvas')).not.toBeNull()
    })

    it('applyTheme updates the renderer background color and the theme cards read on hover', async () => {
        const { scene } = await setup()
        const pixi = await importMockedPixi()
        const mockApp = pixi.__getMockApp() as unknown as { renderer: { background: { color: number } } }

        scene.applyTheme('dark')

        expect(mockApp.renderer.background.color).toBe(0x24202a)
    })

    it('resolves the initial theme from the provided ThemeService and applies it once init resolves', async () => {
        const store = seedStore()
        let listener: ((resolved: 'light' | 'dark') => void) | undefined
        const fakeThemeService = {
            getResolvedTheme: (): 'light' | 'dark' => 'dark',
            onChange: (fn: (resolved: 'light' | 'dark') => void): (() => void) => {
                listener = fn
                return (): void => {}
            },
        }
        const scene = new CanvasScene(store, historyStore, fakeThemeService as never)
        await scene.init(['card-a', 'card-b'], mockSpritesheet as unknown as Spritesheet)
        const pixi = await importMockedPixi()
        const mockApp = pixi.__getMockApp() as unknown as { renderer: { background: { color: number } } }

        expect(mockApp.renderer.background.color).toBe(0x24202a)

        listener?.('light')

        expect(mockApp.renderer.background.color).toBe(0xcdbfad)
    })

    it('reloads the atlas for the scene\'s locale and swaps every card texture when the theme changes', async () => {
        const store = seedStore()
        let listener: ((resolved: 'light' | 'dark') => void) | undefined
        const fakeThemeService = {
            getResolvedTheme: (): 'light' | 'dark' => 'light',
            onChange: (fn: (resolved: 'light' | 'dark') => void): (() => void) => {
                listener = fn
                return (): void => {}
            },
        }
        const cardAtlas = await import('../i18n/card-atlas')
        const loadCardAtlasSpritesheet = cardAtlas.loadCardAtlasSpritesheet as unknown as ReturnType<typeof vi.fn>
        const darkTexture = { width: 200, height: 300 }
        const darkSpritesheet = { textures: { 'card-a': darkTexture, 'card-b': darkTexture } }
        loadCardAtlasSpritesheet.mockResolvedValueOnce(darkSpritesheet)

        const scene = new CanvasScene(store, historyStore, fakeThemeService as never, 'fr')
        await scene.init(['card-a', 'card-b'], mockSpritesheet as unknown as Spritesheet)

        listener?.('dark')
        await Promise.resolve()
        await Promise.resolve()

        expect(loadCardAtlasSpritesheet).toHaveBeenCalledWith('fr', 'dark')
        const testable = scene as unknown as TestableScene
        expect((testable.cards[0] as unknown as { innerSprite: { texture: unknown } }).innerSprite.texture).toBe(darkTexture)
    })

    it('exposes the current screen size after init, resized to the window dimensions', async () => {
        const { scene } = await setup()

        expect(scene.screenWidth).toBe(window.innerWidth)
        expect(scene.screenHeight).toBe(window.innerHeight)
    })

    it('exposes the renderer resolution so textures can be rasterized at the physical pixel density', async () => {
        const { scene } = await setup()

        expect(scene.resolution).toBe(2)
    })

    it('resetPositions clears undo/redo history and animates every card away from its saved position', async () => {
        const { scene, testable, tick } = await setup()
        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!

        for (let i = 0; i < 5; i++) tick()
        scene.undo()
        expect(scene.canUndo).toBe(false)

        scene.resetPositions()
        for (let i = 0; i < 25; i++) tick()

        expect(scene.canUndo).toBe(false)
        expect(scene.canRedo).toBe(false)
        expect(a.x).not.toBe(100)
    })

    it('resetPositions does nothing while a compact animation is in progress', async () => {
        const { scene, testable, tick } = await setup()
        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!
        const b = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-b')!
        ;(scene as unknown as { isCompacting: boolean }).isCompacting = true
        const positionsBefore = { ax: a.x, ay: a.y, bx: b.x, by: b.y }

        scene.resetPositions()
        for (let i = 0; i < 25; i++) tick()

        expect(a.x).toBe(positionsBefore.ax)
        expect(a.y).toBe(positionsBefore.ay)
        expect(b.x).toBe(positionsBefore.bx)
        expect(b.y).toBe(positionsBefore.by)
    })

    it('reflows every card and notifies the resize callback on window resize', async () => {
        const { scene, testable } = await setup()
        const onResize = vi.fn()
        scene.registerOnResize(onResize)

        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!
        const originalX = a.x
        const oldWidth = window.innerWidth

        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 })
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1200 })
        // Invoke the private handler directly rather than dispatching a real
        // 'resize' event: every scene built across this file's tests
        // shares the same mocked Application singleton and registers its own
        // window listener that is never torn down, so a real event would also
        // re-trigger every earlier test's scene against the same screen.
        ;(scene as unknown as { handleResize: () => void }).handleResize()

        expect(onResize).toHaveBeenCalledTimes(1)
        expect(a.x).toBe(originalX * (1600 / oldWidth))
    })

    describe('layout across window sizes', () => {
        type LayoutScene = { cards: Card[]; stacks: Card[][]; stackNames: Record<string, string>; isCompacting: boolean }

        async function setupLayout(state: Partial<CardState>): Promise<{ scene: CanvasScene; testable: LayoutScene; store: CardStateService }> {
            const store = new CardStateService(new InMemoryStore())
            store.save({ positions: {}, order: ['card-a', 'card-b'], onboardingDismissed: false, stackNames: {}, viewport: null, ...state })
            const scene = new CanvasScene(store, historyStore)
            await scene.init(['card-a', 'card-b'], mockSpritesheet as unknown as Spritesheet)
            return { scene, testable: scene as unknown as LayoutScene, store }
        }

        function resizeWindow(scene: CanvasScene, width: number, height: number): void {
            Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })
            ;(scene as unknown as { handleResize: () => void }).handleResize()
        }

        // On the 768-tall jsdom window these two 300-tall cards stand apart; at 400 tall, the bottom clamp pushes card-b onto card-a.
        const APART = { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 100, y: 420 } }

        it('recomputes stacks once a resize clamps two cards into one pile', async () => {
            const { scene, testable } = await setupLayout({ positions: APART })
            expect(testable.stacks).toHaveLength(2)

            resizeWindow(scene, 1024, 400)

            expect(testable.stacks).toHaveLength(1)
        })

        it('fuses the names of two named stacks a resize clamps together into one undoable entry, however many resize events follow', async () => {
            const { scene, testable } = await setupLayout({ positions: APART, stackNames: { 'card-a': 'Joie', 'card-b': 'Calme' } })

            resizeWindow(scene, 1024, 400)
            resizeWindow(scene, 1024, 390)

            expect(testable.stackNames).toEqual({ 'card-a': 'Joie + Calme' })
            scene.undo()
            expect(testable.stackNames).toEqual({ 'card-a': 'Joie', 'card-b': 'Calme' })
            expect(scene.canUndo).toBe(false)
        })

        it('leaves stacks to the gesture in progress when a resize happens mid-gesture', async () => {
            const { scene, testable } = await setupLayout({ positions: APART, stackNames: { 'card-a': 'Joie', 'card-b': 'Calme' } })
            testable.isCompacting = true

            resizeWindow(scene, 1024, 400)

            expect(testable.stacks).toHaveLength(2)
            expect(testable.stackNames).toEqual({ 'card-a': 'Joie', 'card-b': 'Calme' })
        })

        it('saves the positions along with the new canvas size on resize', async () => {
            const { scene, store } = await setupLayout({ positions: APART })

            resizeWindow(scene, 1024, 400)

            expect(store.load('viewport')).toEqual({ width: 1024, height: 400 })
        })

        it('rescales restored positions from the canvas size they were saved under, then saves them with the current one', async () => {
            const { testable, store } = await setupLayout({
                positions: { 'card-a': { x: 200, y: 200 }, 'card-b': { x: 800, y: 200 } },
                viewport: { width: 2048, height: 1536 },
            })

            expect(testable.cards.map((c: Card): { x: number; y: number } => ({ x: c.x, y: c.y }))).toEqual([
                { x: 100, y: 100 },
                { x: 400, y: 100 },
            ])
            expect(store.load('positions')).toEqual({ 'card-a': { x: 100, y: 100 }, 'card-b': { x: 400, y: 100 } })
            expect(store.load('viewport')).toEqual({ width: 1024, height: 768 })
        })

        it('fuses the names of named stacks restored onto each other, without an undo entry', async () => {
            const { scene, testable, store } = await setupLayout({
                positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 110, y: 110 } },
                stackNames: { 'card-a': 'Joie', 'card-b': 'Calme' },
            })

            expect(testable.stackNames).toEqual({ 'card-a': 'Joie + Calme' })
            expect(store.load('stackNames')).toEqual({ 'card-a': 'Joie + Calme' })
            expect(scene.canUndo).toBe(false)
        })

        function recordMove(testable: LayoutScene, card: Card, x: number, y: number): void {
            const { actionHistory, cardLayer } = testable as unknown as { actionHistory: ActionHistory; cardLayer: Container }
            actionHistory.captureBefore(snapshotCards([card], cardLayer))
            card.x = x
            card.y = y
            actionHistory.recordAfter(snapshotCards([card], cardLayer))
        }

        it('rescales a lone card restored by undo/redo from the canvas size its move was recorded under, keeping it on-canvas', async () => {
            const { scene, testable } = await setupLayout({ positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 500, y: 100 } } })
            const cardB = testable.cards[1]
            recordMove(testable, cardB, 500, 420)

            resizeWindow(scene, 1024, 400)
            scene.undo()
            expect(cardB.y).toBeCloseTo(100 * 400 / 768)
            scene.redo()

            // 420 rescaled to 218.75, then clamped so the 300-tall card keeps its pill clearance in a 400-tall canvas.
            expect(cardB.y).toBe(400 - STACK_FRAME_CLEARANCE - 300)
        })

        it('puts a card dropped on a pile back on that pile on redo after a resize, at the same offset in card units', async () => {
            const { scene, testable } = await setupLayout({ positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 500, y: 100 } } })
            const [cardA, cardB] = testable.cards
            recordMove(testable, cardB, 130, 120)

            resizeWindow(scene, 2048, 768)
            scene.undo()
            expect({ x: cardB.x, y: cardB.y }).toEqual({ x: 1000, y: 100 })
            scene.redo()

            expect({ x: cardA.x, y: cardA.y }).toEqual({ x: 200, y: 100 })
            expect({ x: cardB.x, y: cardB.y }).toEqual({ x: 260, y: 140 })
        })

        it('clamps the cards of an entry recorded before the canvas size was tracked', async () => {
            historyStore.save<HistoryData>(HISTORY_KEY, {
                undoStack: [{ cards: { 'card-b': { fromX: 500, fromY: 600, fromIndex: 1, toX: 500, toY: 100, toIndex: 1 } } }],
                redoStack: [],
            })
            const { scene, testable } = await setupLayout({ positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 500, y: 100 } } })

            scene.undo()

            expect(testable.cards[1].y).toBe(768 - STACK_FRAME_CLEARANCE - 300)
        })
    })

    it('mounts the background sprite on the stage below the card layer, baked by the app renderer at the screen size', async () => {
        const { scene, testable } = await setup()
        const background = vi.mocked(createCanvasBackground).mock.results[0].value as { sprite: unknown }
        const children = testable.app.stage.children

        expect(createCanvasBackground).toHaveBeenLastCalledWith(testable.app.renderer, scene.screenWidth, scene.screenHeight, 'light')
        expect(children.indexOf(background.sprite)).toBeGreaterThanOrEqual(0)
        expect(children.indexOf(background.sprite)).toBeLessThan(children.indexOf(testable.cardLayer))
    })

    it('switches the background to the new theme on applyTheme', async () => {
        const { scene } = await setup()
        const background = vi.mocked(createCanvasBackground).mock.results[0].value

        scene.applyTheme('dark')

        expect(applyCanvasBackgroundTheme).toHaveBeenLastCalledWith(background, 'dark')
    })

    it('resizes the background to the new window size on resize', async () => {
        const { scene } = await setup()
        const background = vi.mocked(createCanvasBackground).mock.results[0].value

        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 })
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 })
        ;(scene as unknown as { handleResize: () => void }).handleResize()

        expect(resizeCanvasBackground).toHaveBeenLastCalledWith(background, 1400, 900)
    })

    it('mounts the pile shadow between the background and the card layer', async () => {
        const { testable } = await setup()

        const children = testable.app.stage.children
        expect(children.indexOf(testable.stackShadow.graphics)).toBe(children.indexOf(testable.cardLayer) - 1)
        expect(children.indexOf(testable.stackShadow.graphics)).toBeGreaterThan(0)
    })

    it('redraws the pile shadow from the cards on every frame', async () => {
        const { testable, tick } = await setup()
        const roundRect = vi.spyOn(testable.stackShadow.graphics, 'roundRect')

        tick()

        expect(roundRect).toHaveBeenCalledTimes(testable.cards.length)
    })

    it('eases a dragged card upward on every frame', async () => {
        const { testable, tick } = await setup()
        testable.cards[0].lift.reasons.add('drag')

        tick()

        expect(testable.cards[0].lift.progress).toBeGreaterThan(0)
    })

    it('retunes the pile shadow on applyTheme', async () => {
        const { scene, testable } = await setup()

        scene.applyTheme('dark')

        expect(testable.stackShadow.graphics.tint).toBe(getPixiThemeColors('dark').card.stackShadow.color)
    })

    it('outlines the card under the pointer on every frame and drops the outline once the pointer leaves the canvas', async () => {
        const { testable, tick } = await setup()
        const handlers = testable as unknown as { handlePointerMove(e: unknown): void; handlePointerLeave(): void }
        const [cardA, cardB] = testable.cards as unknown as Array<{ highlight: { visible: boolean } }>

        handlers.handlePointerMove({ global: { x: 150, y: 150 } })
        tick()
        expect(cardA.highlight.visible).toBe(true)
        expect(cardB.highlight.visible).toBe(false)

        handlers.handlePointerLeave()
        tick()
        expect(cardA.highlight.visible).toBe(false)
    })

    it('offers the drag hint on the topmost card', async () => {
        const { scene, testable } = await setup()
        const app = testable.app as unknown as { ticker: unknown }

        scene.offerDragHint()

        expect(startDragHint).toHaveBeenCalledWith(app.ticker, testable.app.stage, testable.cards[1])
    })

    it('stops a running drag hint before offering a new one', async () => {
        const stop = vi.fn()
        vi.mocked(startDragHint).mockReturnValueOnce({ stop } as never)
        const { scene } = await setup()

        scene.offerDragHint()
        scene.offerDragHint()

        expect(stop).toHaveBeenCalledOnce()
    })

    it('skips the drag hint when the user prefers reduced motion', async () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
        const { scene } = await setup()

        scene.offerDragHint()

        expect(startDragHint).not.toHaveBeenCalled()
        vi.unstubAllGlobals()
    })

    it('does not replay the drag hint after a reset', async () => {
        const { scene, tick } = await setup()

        scene.resetPositions()
        for (let i = 0; i < 20; i++) tick()

        expect(startDragHint).not.toHaveBeenCalled()
    })

})
