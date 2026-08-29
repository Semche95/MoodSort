import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Spritesheet } from 'pixi.js'
import { CanvasController } from '../controllers/canvas-controller'
import { CardStateService } from '../services/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'

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

vi.mock('pixi.js', () => {
    const tickers: Array<() => void> = []
    const mockApp: Record<string, unknown> = {
        stage: undefined,
        screen: { width: 800, height: 600 },
        renderer: { resize: vi.fn((w: number, h: number): void => {
            (mockApp.screen as { width: number; height: number }).width = w
            ;(mockApp.screen as { width: number; height: number }).height = h
        }) },
        ticker: {
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
        scale: { set(v: number): void } = { set: vi.fn() }
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
        anchor: { set(x: number, y: number): void } = { set: vi.fn() }
        constructor(options: { text?: string } = {}) {
            super()
            this.text = options.text ?? ''
        }
    }

    return {
        Application: vi.fn(() => mockApp),
        Container: MockContainer,
        Graphics: MockGraphics,
        Sprite: MockSprite,
        Text: MockText,
        BlurFilter: class MockBlurFilter { constructor() {} },
        FederatedPointerEvent: class MockFederatedPointerEvent {},
        __getMockApp: (): Record<string, unknown> => mockApp,
    }
})

async function importMockedPixi(): Promise<{ __getMockApp: () => Record<string, unknown> & { __tick: () => void } }> {
    return (await import('pixi.js')) as unknown as { __getMockApp: () => Record<string, unknown> & { __tick: () => void } }
}

interface TestableController {
    cards: Card[]
    cardLayer: { children: unknown[] }
    app: { stage: { children: unknown[] } }
}

function seedStore(): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({
        positions: { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 400, y: 100 } },
        order: ['card-a', 'card-b'],
        onboardingDismissed: false,
    })
    return store
}

describe('CanvasController', () => {
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
        controller: CanvasController
        testable: TestableController
        tick: () => void
    }> {
        const store = seedStore()
        const controller = new CanvasController(store, historyStore)
        await controller.init(['card-a', 'card-b'], mockSpritesheet as unknown as Spritesheet)
        const pixi = await importMockedPixi()
        const tick = (): void => pixi.__getMockApp().__tick()
        return { controller, testable: controller as unknown as TestableController, tick }
    }

    it('throws when there are no images to load', async () => {
        const store = seedStore()
        const controller = new CanvasController(store, historyStore)

        await expect(controller.init([], mockSpritesheet as unknown as Spritesheet)).rejects.toThrow('No images found')
    })

    it('wires the card layer onto the stage, loads every card, and mounts the canvas in the document', async () => {
        const { controller, testable } = await setup()

        expect(testable.app.stage.children).toContain(testable.cardLayer)
        expect(testable.cards.map((c: Card): string => c.imageUrl)).toEqual(['card-a', 'card-b'])
        expect(controller.stage).toBe(testable.app.stage)
        expect(document.body.querySelector('canvas')).not.toBeNull()
    })

    it('exposes the current screen size after init, resized to the window dimensions', async () => {
        const { controller } = await setup()

        expect(controller.screenWidth).toBe(window.innerWidth)
        expect(controller.screenHeight).toBe(window.innerHeight)
    })

    it('resetPositions clears undo/redo history and animates every card away from its saved position', async () => {
        const { controller, testable, tick } = await setup()
        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!

        for (let i = 0; i < 5; i++) tick()
        controller.undo()
        expect(controller.canUndo).toBe(false)

        controller.resetPositions()
        for (let i = 0; i < 25; i++) tick()

        expect(controller.canUndo).toBe(false)
        expect(controller.canRedo).toBe(false)
        expect(a.x).not.toBe(100)
    })

    it('resetPositions does nothing while a compact animation is in progress', async () => {
        const { controller, testable, tick } = await setup()
        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!
        const b = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-b')!
        ;(controller as unknown as { isCompacting: boolean }).isCompacting = true
        const positionsBefore = { ax: a.x, ay: a.y, bx: b.x, by: b.y }

        controller.resetPositions()
        for (let i = 0; i < 25; i++) tick()

        expect(a.x).toBe(positionsBefore.ax)
        expect(a.y).toBe(positionsBefore.ay)
        expect(b.x).toBe(positionsBefore.bx)
        expect(b.y).toBe(positionsBefore.by)
    })

    it('reflows every card and notifies the resize callback on window resize', async () => {
        const { controller, testable } = await setup()
        const onResize = vi.fn()
        controller.registerOnResize(onResize)

        const a = testable.cards.find((c: Card): boolean => c.imageUrl === 'card-a')!
        const originalX = a.x
        const oldWidth = window.innerWidth

        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 })
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1200 })
        // Invoke the private handler directly rather than dispatching a real
        // 'resize' event: every controller built across this file's tests
        // shares the same mocked Application singleton and registers its own
        // window listener that is never torn down, so a real event would also
        // re-trigger every earlier test's controller against the same screen.
        ;(controller as unknown as { handleResize: () => void }).handleResize()

        expect(onResize).toHaveBeenCalledTimes(1)
        expect(a.x).toBe(originalX * (1600 / oldWidth))
    })
})
