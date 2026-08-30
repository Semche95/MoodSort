import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Application, Container, Spritesheet, Texture } from 'pixi.js'
import { CardManager, createCard, CARD_REFERENCE_WIDTH } from '../features/card/card-manager'
import { Card } from '../types/card.types'
import { CardState } from '../types/card-state.types'

vi.mock('pixi.js', () => {
    class MockContainer {
        children: unknown[] = []
        x: number = 0
        y: number = 0
        width: number = 200
        height: number = 300
        eventMode: string = 'auto'
        cursor: string = 'default'
        filters: unknown[] = []
        scale: { set(v: number): void } = { set: vi.fn() }
        listeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = []
        addChild(child: unknown): unknown {
            this.children.push(child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        on(event: string, handler: (...args: unknown[]) => void): this {
            this.listeners.push({ event, handler })
            return this
        }
    }
    class MockGraphics extends MockContainer {
        roundRect(): this { return this }
        fill(): this { return this }
    }
    class MockSprite extends MockContainer {
        texture: unknown
        tint: number = 0xffffff
        constructor(texture: { width?: number; height?: number }) {
            super()
            this.texture = texture
            this.width = texture.width ?? 200
            this.height = texture.height ?? 300
        }
    }
    return {
        Container: MockContainer,
        Graphics: MockGraphics,
        Sprite: MockSprite,
        BlurFilter: class MockBlurFilter { constructor() {} },
    }
})

function makeCard(imageUrl: string, x: number, y: number, width: number = 200, height: number = 300): Card {
    return { imageUrl, x, y, width, height, scale: { set: vi.fn() } } as unknown as Card
}

function makeState(order: string[]): CardState {
    return { positions: {}, order, onboardingDismissed: false }
}

type Listener = { event: string; handler: (...args: unknown[]) => void }

describe('createCard', () => {
    it('builds a card carrying its frame name, a shadow, and the sprite as innerSprite', () => {
        const texture = { width: 200, height: 300 }
        const card = createCard('card-a', texture as unknown as Texture, vi.fn()) as unknown as Container & { children: unknown[]; imageUrl: string; innerSprite: unknown }

        expect(card.imageUrl).toBe('card-a')
        expect(card.eventMode).toBe('static')
        expect(card.cursor).toBe('move')
        expect(card.children).toHaveLength(2)
        expect(card.innerSprite).toBe(card.children[1])
    })

    it('wires pointerdown to the given callback and dims/restores the sprite tint on hover', () => {
        const texture = { width: 200, height: 300 }
        const onDragStart = vi.fn()
        const card = createCard('card-a', texture as unknown as Texture, onDragStart) as unknown as Container & {
            listeners: Listener[]
            innerSprite: { tint: number }
        }

        const pointerdown = card.listeners.find((l: Listener): boolean => l.event === 'pointerdown')!
        expect(pointerdown.handler).toBe(onDragStart)

        const pointerover = card.listeners.find((l: Listener): boolean => l.event === 'pointerover')!
        pointerover.handler()
        expect(card.innerSprite.tint).toBe(0xFFEEDD)

        const pointerout = card.listeners.find((l: Listener): boolean => l.event === 'pointerout')!
        pointerout.handler()
        expect(card.innerSprite.tint).toBe(0xFFFFFF)
    })
})

describe('CardManager', () => {
    let app: Application
    let cardLayer: Container
    let manager: CardManager

    beforeEach(async () => {
        const { Container: MockContainer } = await import('pixi.js')
        app = { screen: { width: 1280, height: 720 } } as unknown as Application
        cardLayer = new MockContainer() as unknown as Container
        manager = new CardManager(app, cardLayer)
    })

    describe('resolveOrder', () => {
        it('keeps the saved order when it contains exactly the same images', () => {
            const images = ['a', 'b', 'c']
            const result = manager.resolveOrder(images, makeState(['c', 'a', 'b']))

            expect(result).toEqual(['c', 'a', 'b'])
        })

        it('falls back to a shuffled order when the saved order has a different length', () => {
            const images = ['a', 'b', 'c']
            const result = manager.resolveOrder(images, makeState(['a', 'b']))

            expect(result).toHaveLength(3)
            expect([...result].sort()).toEqual(['a', 'b', 'c'])
        })

        it('falls back to a shuffled order when the saved order references images that no longer exist', () => {
            const images = ['a', 'b', 'c']
            const result = manager.resolveOrder(images, makeState(['a', 'b', 'z']))

            expect(result).toHaveLength(3)
            expect([...result].sort()).toEqual(['a', 'b', 'c'])
        })
    })

    describe('loadCards', () => {
        it('creates one card per frame name, in order, and adds each to the card layer', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 }, b: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a', 'b'], {}, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards.map((c: Card): string => c.imageUrl)).toEqual(['a', 'b'])
            expect(cardLayer.children).toEqual(cards)
        })

        it('places a card at its saved position when one exists', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], { a: { x: 42, y: 84 } }, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards[0].x).toBe(42)
            expect(cards[0].y).toBe(84)
        })

        it('centers a card with jitter when it has no saved position', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet)

            const centerX = (app.screen.width - cards[0].width) / 2
            const centerY = (app.screen.height - cards[0].height) / 2
            expect(cards[0].x).toBeGreaterThanOrEqual(centerX - 25)
            expect(cards[0].x).toBeLessThanOrEqual(centerX + 25)
            expect(cards[0].y).toBeGreaterThanOrEqual(centerY - 25)
            expect(cards[0].y).toBeLessThanOrEqual(centerY + 25)
        })
    })

    describe('applyScale', () => {
        it('scales the card relative to the reference card width', () => {
            const card = makeCard('a', 0, 0)
            const setSpy = vi.fn()
            ;(card as unknown as { scale: { set: typeof setSpy } }).scale = { set: setSpy }

            manager.applyScale(card)

            expect(setSpy).toHaveBeenCalledWith(app.screen.width / CARD_REFERENCE_WIDTH)
        })
    })

    describe('placeCard', () => {
        it('uses the saved position when provided', () => {
            const card = makeCard('a', 0, 0)

            manager.placeCard(card, { x: 15, y: 30 })

            expect(card.x).toBe(15)
            expect(card.y).toBe(30)
        })

        it('centers with jitter when no saved position is provided', () => {
            const card = makeCard('a', 0, 0, 200, 300)

            manager.placeCard(card)

            const centerX = (app.screen.width - card.width) / 2
            const centerY = (app.screen.height - card.height) / 2
            expect(card.x).toBeGreaterThanOrEqual(centerX - 25)
            expect(card.x).toBeLessThanOrEqual(centerX + 25)
            expect(card.y).toBeGreaterThanOrEqual(centerY - 25)
            expect(card.y).toBeLessThanOrEqual(centerY + 25)
        })
    })

    describe('repositionForResize', () => {
        it('rescales, applies the resize ratio, and constrains the card within the new viewport', () => {
            const card = makeCard('a', 100, 100, 200, 300)
            const setSpy = vi.fn()
            ;(card as unknown as { scale: { set: typeof setSpy } }).scale = { set: setSpy }

            manager.repositionForResize(card, 2, 2, 1000, 1000)

            expect(setSpy).toHaveBeenCalledWith(app.screen.width / CARD_REFERENCE_WIDTH)
            expect(card.x).toBe(200)
            expect(card.y).toBe(200)
        })

        it('clamps the card back inside the viewport when the resize would push it out of bounds', () => {
            const card = makeCard('a', 900, 900, 200, 300)

            manager.repositionForResize(card, 1, 1, 1000, 1000)

            expect(card.x).toBeLessThanOrEqual(1000 - card.width)
            expect(card.y).toBeLessThanOrEqual(1000 - card.height)
        })
    })

    describe('shuffleAndBuildTargets', () => {
        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('builds one animation target per card, re-adds every card to the card layer, and does not add a rotation property', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0)
            const a = makeCard('a', 10, 10)
            const b = makeCard('b', 20, 20)

            const targets = manager.shuffleAndBuildTargets([a, b])

            expect(targets).toHaveLength(2)
            expect(cardLayer.children).toEqual(expect.arrayContaining([a, b]))
            for (const target of targets) {
                expect(Object.prototype.hasOwnProperty.call(target, 'rotation')).toBe(false)
                expect(target.fromX).toBe(target.card.x)
                expect(target.fromY).toBe(target.card.y)
            }
        })
    })

    describe('shuffleImages', () => {
        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('returns a permutation containing exactly the same images', () => {
            const images = ['a', 'b', 'c', 'd']

            const shuffled = manager.shuffleImages(images)

            expect([...shuffled].sort()).toEqual([...images].sort())
        })

        it('does not mutate the input array', () => {
            const images = ['a', 'b', 'c']

            manager.shuffleImages(images)

            expect(images).toEqual(['a', 'b', 'c'])
        })

        it('is deterministic given a fixed random source', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0)

            expect(manager.shuffleImages(['a', 'b', 'c'])).toEqual(['b', 'c', 'a'])
        })
    })
})
