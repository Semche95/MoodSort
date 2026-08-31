import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Spritesheet } from 'pixi.js'
import { CanvasScene } from '../app/canvas-scene'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'
import { CardActionEntry, HistoryData, HISTORY_KEY } from '../types/history.types'

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

vi.mock('pixi.js', () => {
    const tickers: Array<() => void> = []
    const mockApp: Record<string, unknown> = {
        stage: undefined,
        screen: { width: 800, height: 600 },
        renderer: { resize: vi.fn() },
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
        scale: { set(v: number): void } = { set: vi.fn() }
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
        BlurFilter: class MockBlurFilter {
            constructor() {}
        },
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
    handleCompactButtonPointerDown: (e: { global: { x: number; y: number } }) => void
}

function seedStore(historyStore: InMemoryStore, priorEntry?: CardActionEntry): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({
        positions: {
            'card-a': { x: 100, y: 100 },
            'card-b': { x: 110, y: 110 },
            'card-top': { x: 90, y: 95 },
            // Kept well within the 800x600 mock screen (unlike the a/b/top trio,
            // which cluster near the origin) so it stays untouched by clamping.
            'card-other': { x: 500, y: 250 },
        },
        order: ['card-a', 'card-b', 'card-top', 'card-other'],
        onboardingDismissed: false,
        stackNames: {},
    })
    if (priorEntry) {
        historyStore.save<HistoryData>(HISTORY_KEY, { undoStack: [priorEntry], redoStack: [] })
    }
    return store
}

function findCard(scene: TestableScene, imageUrl: string): Card {
    const card = scene.cards.find((c: Card): boolean => c.imageUrl === imageUrl)
    if (!card) {
        throw new Error(`card not found: ${imageUrl}`)
    }
    return card
}

describe('CanvasScene compact stack action', () => {
    let historyStore: InMemoryStore

    beforeEach(() => {
        vi.clearAllMocks()
        historyStore = new InMemoryStore()
    })

    async function setup(priorEntry?: CardActionEntry): Promise<{
        scene: CanvasScene
        testable: TestableScene
        tick: () => void
    }> {
        const store = seedStore(historyStore, priorEntry)
        const scene = new CanvasScene(store, historyStore)
        await scene.init(
            ['card-a', 'card-b', 'card-top', 'card-other'],
            mockSpritesheet as unknown as Spritesheet,
        )
        const pixi = await importMockedPixi()
        const tick = (): void => pixi.__getMockApp().__tick()
        return { scene, testable: scene as unknown as TestableScene, tick }
    }

    it('leaves the top card in place and disperses the others around it, without touching unrelated cards or z-order', async () => {
        const { testable, tick } = await setup()
        const { computeCompactButtonBox } = await import('../features/stack/stack')

        const box = computeCompactButtonBox([
            { x: 100, y: 100, width: 200, height: 300 } as unknown as Card,
            { x: 110, y: 110, width: 200, height: 300 } as unknown as Card,
            { x: 90, y: 95, width: 200, height: 300 } as unknown as Card,
        ])!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        const orderBefore = [...testable.cardLayer.children]
        const other = findCard(testable, 'card-other')

        testable.handleCompactButtonPointerDown({ global: point })
        for (let i = 0; i < 25; i++) {
            tick()
        }

        const top = findCard(testable, 'card-top')
        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')

        expect(top.x).toBe(90)
        expect(top.y).toBe(95)

        expect(a.x).toBeGreaterThanOrEqual(90 - 25)
        expect(a.x).toBeLessThanOrEqual(90 + 25)
        expect(a.y).toBeGreaterThanOrEqual(95 - 25)
        expect(a.y).toBeLessThanOrEqual(95 + 25)
        expect(b.x).toBeGreaterThanOrEqual(90 - 25)
        expect(b.x).toBeLessThanOrEqual(90 + 25)
        expect(b.y).toBeGreaterThanOrEqual(95 - 25)
        expect(b.y).toBeLessThanOrEqual(95 + 25)

        expect(Object.prototype.hasOwnProperty.call(a, 'rotation')).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(b, 'rotation')).toBe(false)

        expect(other.x).toBe(500)
        expect(other.y).toBe(250)

        expect(testable.cardLayer.children).toEqual(orderBefore)
    })

    it('pushes a single undo/redo entry and does not clear pre-existing history', async () => {
        const priorEntry: CardActionEntry = {
            cards: {
                'card-other': { fromX: 490, fromY: 240, fromIndex: 3, toX: 500, toY: 250, toIndex: 3 },
            },
        }
        const { scene, testable, tick } = await setup(priorEntry)
        const { computeCompactButtonBox } = await import('../features/stack/stack')

        const box = computeCompactButtonBox([
            { x: 100, y: 100, width: 200, height: 300 } as unknown as Card,
            { x: 110, y: 110, width: 200, height: 300 } as unknown as Card,
            { x: 90, y: 95, width: 200, height: 300 } as unknown as Card,
        ])!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        expect(scene.canUndo).toBe(true)

        testable.handleCompactButtonPointerDown({ global: point })
        for (let i = 0; i < 25; i++) {
            tick()
        }

        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')
        const compactedA = { x: a.x, y: a.y }
        const compactedB = { x: b.x, y: b.y }

        const historyAfterCompact = historyStore.load<HistoryData>(HISTORY_KEY)
        expect(historyAfterCompact?.undoStack).toHaveLength(2)

        scene.undo()

        expect(a.x).toBe(100)
        expect(a.y).toBe(100)
        expect(b.x).toBe(110)
        expect(b.y).toBe(110)
        expect(scene.canUndo).toBe(true)
        expect(scene.canRedo).toBe(true)

        const other = findCard(testable, 'card-other')
        expect(other.x).toBe(500)
        expect(other.y).toBe(250)

        scene.redo()

        expect(a.x).toBe(compactedA.x)
        expect(a.y).toBe(compactedA.y)
        expect(b.x).toBe(compactedB.x)
        expect(b.y).toBe(compactedB.y)
    })

    it('does nothing when the point does not land on any compact button', async () => {
        const { scene, testable } = await setup()

        testable.handleCompactButtonPointerDown({ global: { x: -9999, y: -9999 } })

        expect(scene.canUndo).toBe(false)
        const a = findCard(testable, 'card-a')
        expect(a.x).toBe(100)
        expect(a.y).toBe(100)
    })
})
