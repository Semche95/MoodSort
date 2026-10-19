import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Spritesheet } from 'pixi.js'
import { CanvasScene } from '../app/canvas-scene'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'
import { computeStackActionsLayout } from '../features/stack/stack-hit-testing'
import type { StackSpread } from '../features/stack/stack-spread/stack-spread'
import type { DragHandler } from '../features/drag/drag-handler'

const { mockSpritesheet } = vi.hoisted(() => {
    const mockTexture = { width: 200, height: 300 }
    return {
        mockSpritesheet: {
            textures: {
                'card-a': mockTexture,
                'card-b': mockTexture,
                'card-top': mockTexture,
                'card-other': mockTexture,
            },
        },
    }
})

vi.mock('../features/background/canvas-background', () => ({
    createCanvasBackground: vi.fn(() => ({ sprite: { label: 'canvas-background' } })),
    resizeCanvasBackground: vi.fn(),
    applyCanvasBackgroundTheme: vi.fn(),
}))

vi.mock('pixi.js', () => {
    const tickers: Array<() => void> = []
    const mockApp: Record<string, unknown> = {
        stage: undefined,
        screen: { width: 800, height: 600 },
        renderer: { resize: vi.fn(), events: { rootBoundary: { hitTest: vi.fn((): null => null) } } },
        ticker: {
            add: (fn: () => void): void => {
                tickers.push(fn)
            },
            remove: (fn: () => void): void => {
                const index = tickers.indexOf(fn)
                if (index !== -1) {
                    tickers.splice(index, 1)
                }
            },
        },
        init: vi.fn().mockResolvedValue(undefined),
        canvas: document.createElement('canvas'),
        __tick: (): void => {
            for (const fn of [...tickers]) {
                fn()
            }
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
        on(): this {
            return this
        }
        off(): this {
            return this
        }
        cacheAsTexture(): void {}
        updateCacheTexture(): void {}
        getLocalBounds(): { x: number; y: number; width: number; height: number } {
            return { x: 0, y: 0, width: this.width, height: this.height }
        }
        addChild(child: unknown): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) {
                this.children.splice(existing, 1)
            }
            this.children.push(child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        addChildAt(child: unknown, index: number): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) {
                this.children.splice(existing, 1)
            }
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
        BlurFilter: class MockBlurFilter {
            constructor() {}
        },
        AlphaFilter: class MockAlphaFilter { alpha: number = 1 },
        Rectangle: class MockRectangle {},
        Texture: { EMPTY: { width: 0, height: 0 } },
        FederatedPointerEvent: class MockFederatedPointerEvent {},
        __getMockApp: (): Record<string, unknown> => mockApp,
    }
})

async function importMockedPixi(): Promise<{ __getMockApp: () => { __tick: () => void } }> {
    return (await import('pixi.js')) as unknown as { __getMockApp: () => { __tick: () => void } }
}

interface TestableScene {
    cards: Card[]
    cardLayer: { children: unknown[] }
    stackSpread: StackSpread
    dragHandler: DragHandler
    handleActionsPillPointerDown: (e: { global: { x: number; y: number } }) => void
    grabSpreadCard: (card: Card, e: { global: { x: number; y: number }; buttons: number }, grabOffset: { x: number; y: number }) => void
    isCompacting: boolean
}

function seedStore(): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({
        positions: {
            'card-a': { x: 100, y: 100 },
            'card-b': { x: 110, y: 110 },
            'card-top': { x: 90, y: 95 },
            'card-other': { x: 580, y: 250 },
        },
        order: ['card-a', 'card-b', 'card-top', 'card-other'],
        onboardingDismissed: false,
        stackNames: {},
        viewport: null,
    })
    return store
}

function findCard(scene: TestableScene, imageUrl: string): Card {
    const card = scene.cards.find((c: Card): boolean => c.imageUrl === imageUrl)
    if (!card) {
        throw new Error(`card not found: ${imageUrl}`)
    }
    return card
}

function pressSpreadButton(testable: TestableScene): void {
    const box = computeStackActionsLayout([
        { x: 100, y: 100, width: 200, height: 300 } as unknown as Card,
        { x: 110, y: 110, width: 200, height: 300 } as unknown as Card,
        { x: 90, y: 95, width: 200, height: 300 } as unknown as Card,
    ])!.spread
    testable.handleActionsPillPointerDown({ global: { x: box.x + box.width / 2, y: box.y + box.height / 2 } })
}

describe('CanvasScene stack spread', () => {
    let historyStore: InMemoryStore

    beforeEach(() => {
        vi.clearAllMocks()
        historyStore = new InMemoryStore()
    })

    async function setup(): Promise<{ scene: CanvasScene; testable: TestableScene; tick: () => void }> {
        const scene = new CanvasScene(seedStore(), historyStore)
        await scene.init(['card-a', 'card-b', 'card-top', 'card-other'], mockSpritesheet as unknown as Spritesheet)
        const pixi = await importMockedPixi()
        return { scene, testable: scene as unknown as TestableScene, tick: (): void => pixi.__getMockApp().__tick() }
    }

    it('opens the spread of the stack whose spread button is pressed, top card first', async () => {
        const { testable } = await setup()

        pressSpreadButton(testable)

        expect(testable.stackSpread.isOpen).toBe(true)
        expect(testable.stackSpread['cards'].map((card: Card): string => card.imageUrl)).toEqual(['card-top', 'card-b', 'card-a'])
    })

    it('closes the spread on Escape', async () => {
        const { testable } = await setup()
        pressSpreadButton(testable)

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

        expect(testable.stackSpread.isOpen).toBe(false)
    })

    it('drags a card pulled out of the spread like a board drag: one history entry, undone back onto its pile', async () => {
        const { scene, testable, tick } = await setup()
        pressSpreadButton(testable)
        const card = findCard(testable, 'card-a')

        testable.grabSpreadCard(card, { global: { x: 380, y: 300 }, buttons: 1 }, { x: -50, y: -60 })
        expect(testable.dragHandler.isDragging).toBe(true)
        expect({ x: card.x, y: card.y }).toEqual({ x: 330, y: 240 })
        testable.dragHandler.handleDragEnd()
        tick()

        expect(scene.canUndo).toBe(true)
        expect(testable.stackSpread['cards'].map((c: Card): string => c.imageUrl)).toEqual(['card-top', 'card-b'])
        scene.undo()
        tick()
        expect({ x: card.x, y: card.y }).toEqual({ x: 100, y: 100 })
        expect(testable.stackSpread['cards']).toHaveLength(3)
    })

    it('does not pull a card out of the spread while a stack is being compacted', async () => {
        const { testable } = await setup()
        pressSpreadButton(testable)
        testable.isCompacting = true

        testable.grabSpreadCard(findCard(testable, 'card-a'), { global: { x: 600, y: 400 }, buttons: 1 }, { x: 0, y: 0 })

        expect(testable.dragHandler.isDragging).toBe(false)
    })

    it('closes the spread when the positions are reset', async () => {
        const { scene, testable } = await setup()
        pressSpreadButton(testable)

        scene.resetPositions()

        expect(testable.stackSpread.isOpen).toBe(false)
    })
})
