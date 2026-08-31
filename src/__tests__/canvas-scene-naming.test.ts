import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Container, FederatedPointerEvent, Spritesheet } from 'pixi.js'
import { CanvasScene } from '../app/canvas-scene'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'
import { computeNameButtonBox, computeStackLabel } from '../features/stack/stack'
import { HistoryData, HISTORY_KEY } from '../types/history.types'

const { mockSpritesheet } = vi.hoisted(() => {
    const mockTexture = { width: 200, height: 300 }
    return {
        mockSpritesheet: {
            textures: {
                'card-a': mockTexture,
                'card-b': mockTexture,
                'card-c': mockTexture,
                'card-x': mockTexture,
                'card-y': mockTexture,
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
        visible: boolean = true
        label: string = ''
        parent: unknown = null
        scale: { set(v: number): void } = { set: vi.fn() }
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        getGlobalPosition(): { x: number; y: number } {
            return { x: this.x, y: this.y }
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
        moveTo(): this { return this }
        lineTo(): this { return this }
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

interface TestableScene {
    cards: Card[]
    cardLayer: { children: unknown[] }
    stackNames: Record<string, string>
    dragHandler: {
        handleDragStart: (e: FederatedPointerEvent) => void
        handleDragMove: (e: FederatedPointerEvent) => void
        handleDragEnd: () => void
    }
    handleNameButtonPointerDown: (e: { global: { x: number; y: number } }) => void
}

function seedStore(positions: Record<string, { x: number; y: number }>, order: string[]): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({
        positions,
        order,
        onboardingDismissed: false,
        stackNames: {},
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

/**
 * The name editor now delegates typing to a real (invisible, off-screen)
 * `<input>` element it creates on open and removes on close, so it can be
 * driven the same way here: mutate that input the way a browser would before
 * the keystroke/input events our code listens for.
 */
function typeIntoNameEditor(name: string): void {
    const input = document.body.querySelector('input')
    if (!input) {
        throw new Error('name editor input not found: was it opened?')
    }
    for (const ch of name) {
        const pos = input.value.length
        input.value += ch
        input.setSelectionRange(pos + 1, pos + 1)
        input.dispatchEvent(new Event('input', { bubbles: true }))
    }
}

function pressEnterInNameEditor(): void {
    const input = document.body.querySelector('input')
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}

/** Drives the full name-button-click -> type -> Enter flow through real keyboard/input events, exactly as a user would. */
function nameStack(testable: TestableScene, stack: Card[], name: string): void {
    const box = computeNameButtonBox(stack)
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    testable.handleNameButtonPointerDown({ global: point })
    typeIntoNameEditor(name)
    pressEnterInNameEditor()
}

/** Drags a single card (via the real DragHandler) straight to a target position, bypassing pointer-delta math. */
function dragCardTo(testable: TestableScene, card: Card, targetX: number, targetY: number): void {
    testable.dragHandler.handleDragStart({ currentTarget: card, global: { x: 0, y: 0 }, buttons: 1 } as unknown as FederatedPointerEvent)
    const offsetX = card.x
    const offsetY = card.y
    testable.dragHandler.handleDragMove({
        global: { x: targetX - offsetX, y: targetY - offsetY },
        buttons: 1,
    } as unknown as FederatedPointerEvent)
    testable.dragHandler.handleDragEnd()
}

describe('CanvasScene stack naming', () => {
    let historyStore: InMemoryStore

    beforeEach(() => {
        vi.clearAllMocks()
        historyStore = new InMemoryStore()
    })

    async function setup(store: CardStateService, frameNames: string[]): Promise<{
        scene: CanvasScene
        testable: TestableScene
    }> {
        const scene = new CanvasScene(store, historyStore)
        await scene.init(frameNames, mockSpritesheet as unknown as Spritesheet)
        return { scene, testable: scene as unknown as TestableScene }
    }

    it('persists a stack name across a reload', async () => {
        const store = seedStore(
            { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 110, y: 110 } },
            ['card-a', 'card-b'],
        )
        const { testable } = await setup(store, ['card-a', 'card-b'])
        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')

        nameStack(testable, [a, b], 'Joie')

        expect(store.load('stackNames')).toEqual({ 'card-a': 'Joie' })

        const { testable: reloaded } = await setup(store, ['card-a', 'card-b'])

        expect(reloaded.stackNames).toEqual({ 'card-a': 'Joie' })
    })

    it('keeps the name on the anchor when the stack shrinks to one card, then when it regains its stack-mate', async () => {
        const store = seedStore(
            { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 110, y: 110 } },
            ['card-a', 'card-b'],
        )
        const { testable } = await setup(store, ['card-a', 'card-b'])
        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')

        nameStack(testable, [a, b], 'Joie')
        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })

        // Drag the non-anchor card away: the anchor (card-a) is left alone.
        dragCardTo(testable, b, 500, 250)

        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })
        expect(computeStackLabel([a], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('Joie')

        // Bring it back: the stack regains its stack-mate, the name is still there.
        dragCardTo(testable, b, 100, 100)

        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })
        expect(computeStackLabel([a, b], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('Joie')
    })

    it('reassigns the name to the card left behind when the named card is dragged away alone, since a lone dragged card never outranks the untouched one', async () => {
        const store = seedStore(
            { 'card-a': { x: 100, y: 100 }, 'card-b': { x: 110, y: 110 } },
            ['card-a', 'card-b'],
        )
        const { scene, testable } = await setup(store, ['card-a', 'card-b'])
        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')

        nameStack(testable, [a, b], 'Joie')
        expect(historyStore.load<HistoryData>(HISTORY_KEY)?.undoStack).toHaveLength(1)

        // card-a is the named card; drag it away alone, leaving card-b behind.
        // Both resulting piles end up solo, so the tie is broken by z-order:
        // the untouched card-b outranks card-a, which the drag itself just
        // raised to the top, so the name follows card-b instead.
        dragCardTo(testable, a, 500, 250)

        expect(testable.stackNames).toEqual({ 'card-b': 'Joie' })
        expect(computeStackLabel([a], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('')
        expect(computeStackLabel([b], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('Joie')
        // The drag's own position entry, plus a separate entry for the
        // reassignment it triggered (only known once the split was detected).
        expect(historyStore.load<HistoryData>(HISTORY_KEY)?.undoStack).toHaveLength(3)
        expect(scene.canUndo).toBe(true)

        // First undo reverts only the reassignment; the drag itself still stands.
        scene.undo()

        expect(a.x).toBe(500)
        expect(a.y).toBe(250)
        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })
        expect(historyStore.load<HistoryData>(HISTORY_KEY)?.undoStack).toHaveLength(2)
        expect(scene.canRedo).toBe(true)

        // Second undo reverts the drag itself.
        scene.undo()

        expect(a.x).toBe(100)
        expect(a.y).toBe(100)
        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })
        expect(historyStore.load<HistoryData>(HISTORY_KEY)?.undoStack).toHaveLength(1)

        scene.redo()
        scene.redo()

        expect(a.x).toBe(500)
        expect(a.y).toBe(250)
        expect(testable.stackNames).toEqual({ 'card-b': 'Joie' })
    })

    it('fuses both names into one string when two named stacks merge, and keeps that fused name intact once they split back apart', async () => {
        const store = seedStore(
            { 'card-x': { x: 100, y: 100 }, 'card-y': { x: 500, y: 250 } },
            ['card-x', 'card-y'],
        )
        const { testable } = await setup(store, ['card-x', 'card-y'])
        const x = findCard(testable, 'card-x')
        const y = findCard(testable, 'card-y')

        nameStack(testable, [x], 'Joie')
        nameStack(testable, [y], 'Colère')

        dragCardTo(testable, y, 100, 100)

        expect(testable.stackNames).toEqual({ 'card-x': 'Joie + Colère' })
        expect(computeStackLabel([x, y], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('Joie + Colère')

        dragCardTo(testable, y, 500, 250)

        expect(testable.stackNames).toEqual({ 'card-x': 'Joie + Colère' })
        expect(computeStackLabel([x], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('Joie + Colère')
        expect(computeStackLabel([y], testable.cardLayer as unknown as Container, testable.stackNames)).toBe('')
    })

    it('rename button targets whichever card the name was reassigned to, even after several splits and a re-merge', async () => {
        const store = seedStore(
            {
                'card-a': { x: 100, y: 100 },
                'card-b': { x: 110, y: 110 },
                'card-c': { x: 120, y: 120 },
            },
            ['card-a', 'card-b', 'card-c'],
        )
        const { scene, testable } = await setup(store, ['card-a', 'card-b', 'card-c'])
        const a = findCard(testable, 'card-a')
        const b = findCard(testable, 'card-b')
        const c = findCard(testable, 'card-c')

        nameStack(testable, [a, b, c], 'Joie')
        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })

        // 3 leaves the pile alone: the remaining {a, b} still has 2 cards
        // against a solo c, so the name stays put on card-a.
        dragCardTo(testable, c, 700, 400)
        expect(testable.stackNames).toEqual({ 'card-a': 'Joie' })

        // 2 leaves the remaining pair and joins 3 elsewhere: now card-a is
        // left alone against the 2-card {b, c} group, so the name jumps to
        // whichever of b/c has the lower z-order there (card-c, since card-b
        // was just raised to the top by this very drag).
        dragCardTo(testable, b, 700, 400)
        expect(testable.stackNames).toEqual({ 'card-c': 'Joie' })

        // 1 is dragged back onto {2, 3}: everyone re-merges into a single
        // group again, so nothing splits and the name stays where it is.
        dragCardTo(testable, a, 700, 400)

        expect(testable.stackNames).toEqual({ 'card-c': 'Joie' })

        const overlay = (scene as unknown as { overlay: { nameEditor: { value: string } } }).overlay
        const box = computeNameButtonBox([a, b, c])
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        testable.handleNameButtonPointerDown({ global: point })

        // Must prefill the name that's actually displayed, not an empty field
        // for whichever card is now lowest in z-order.
        expect(overlay.nameEditor.value).toBe('Joie')

        pressEnterInNameEditor()

        // Committing without changes must not leave a stray duplicate entry.
        expect(testable.stackNames).toEqual({ 'card-c': 'Joie' })
    })
})
