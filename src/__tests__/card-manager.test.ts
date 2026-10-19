import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Application, Container, Graphics, Spritesheet, Texture } from 'pixi.js'
import {
    CardManager,
    createCard,
    drawCardHighlight,
    drawCardShadowShape,
    CARD_REFERENCE_WIDTH,
    REST_SHADOW_LAYERS,
    REST_SHADOW_SPREAD,
} from '../features/card/card-manager'
import { REST_SHADOW_OFFSET_Y } from '../features/card/card-lift'
import { STACK_HANDLE_TOP_CLEARANCE } from '../features/stack/stack'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { Card } from '../types/card.types'
import { CardState } from '../types/card-state.types'
import { CARD_CORNER_RADIUS } from '../features/card/card-corner-radius'

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
        alpha: number = 1
        tint: number = 0xffffff
        interactiveChildren: boolean = true
        boundsArea: unknown = null
        hitArea: unknown = null
        scale: { x: number; y: number; set(v: number): void } = {
            x: 1,
            y: 1,
            set: vi.fn(function set(this: { x: number; y: number }, v: number): void { this.x = v; this.y = v }),
        }
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
        visible: boolean = true
        strokes: unknown[] = []
        fills: unknown[] = []
        clear(): this {
            this.strokes = []
            this.rects = []
            this.roundRects = []
            return this
        }
        roundRects: number[][] = []
        rects: number[][] = []
        roundRect(...args: number[]): this {
            this.roundRects.push(args)
            return this
        }
        rect(...args: number[]): this {
            this.rects.push(args)
            return this
        }
        fill(style: unknown): this {
            this.fills.push(style)
            return this
        }
        stroke(style: unknown): this {
            this.strokes.push(style)
            return this
        }
    }
    class MockSprite extends MockContainer {
        texture: unknown
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
        BlurFilter: class MockBlurFilter {
            strength: number = 0
        },
        Rectangle: class MockRectangle {
            constructor(public x: number, public y: number, public width: number, public height: number) {}
        },
    }
})

function makeCard(imageUrl: string, x: number, y: number, width: number = 200, height: number = 300): Card {
    return { imageUrl, x, y, width, height, scale: { set: vi.fn() } } as unknown as Card
}

function makeState(order: string[]): CardState {
    return { positions: {}, order, onboardingDismissed: false, stackNames: {} }
}

type Listener = { event: string; handler: (...args: unknown[]) => void }

type CardShape = Container & {
    imageUrl: string
    children: unknown[]
    listeners: Listener[]
    body: { children: unknown[] }
    innerSprite: unknown
    highlight: { visible: boolean; strokes: unknown[] }
    shadow: { tint: number; alpha: number; y: number; filters: unknown[]; fills: unknown[] }
    lift: { progress: number; reasons: Set<string> }
    boundsArea: { x: number; y: number; width: number; height: number }
    hitArea: unknown
    interactiveChildren: boolean
}

function buildCard(theme: 'light' | 'dark' = 'light', onDragStart: () => void = vi.fn()): CardShape {
    const texture = { width: 200, height: 300 }
    return createCard('card-a', texture as unknown as Texture, onDragStart, () => theme) as unknown as CardShape
}

function fire(card: CardShape, event: string): void {
    card.listeners.find((l: Listener): boolean => l.event === event)!.handler()
}

type MockGraphicsShape = Graphics & { roundRects: number[][]; rects: number[][]; fills: unknown[]; strokes: unknown[] }

describe('drawCardShadowShape', () => {
    it('draws the widest ring first, each one a spread step larger than the next, all equally translucent', async () => {
        const { Graphics: MockGraphics } = await import('pixi.js')
        const shadow = new MockGraphics() as MockGraphicsShape

        drawCardShadowShape(shadow, 200, 300)

        const outer = REST_SHADOW_LAYERS * REST_SHADOW_SPREAD
        expect(shadow.roundRects[0]).toEqual([-outer, -outer, 200 + outer * 2, 300 + outer * 2, CARD_CORNER_RADIUS + outer])
        expect(shadow.roundRects[shadow.roundRects.length - 1]).toEqual([
            -REST_SHADOW_SPREAD,
            -REST_SHADOW_SPREAD,
            200 + REST_SHADOW_SPREAD * 2,
            300 + REST_SHADOW_SPREAD * 2,
            CARD_CORNER_RADIUS + REST_SHADOW_SPREAD,
        ])
        expect(new Set(shadow.fills.map((fill: unknown): string => JSON.stringify(fill))).size).toBe(1)
    })
})

describe('drawCardHighlight', () => {
    it('strokes the rounded card frame inside its edges, so the outline never spills onto a neighbour', async () => {
        const { Graphics: MockGraphics } = await import('pixi.js')
        const highlight = new MockGraphics() as MockGraphicsShape
        const outline = { color: 0x123456, alpha: 0.5, width: 3 }

        drawCardHighlight(highlight, 200, 300, outline)

        expect(highlight.roundRects).toEqual([[0, 0, 200, 300, CARD_CORNER_RADIUS]])
        expect(highlight.strokes).toEqual([{ ...outline, alignment: 0 }])
    })

    it('replaces the previous outline instead of adding to it', async () => {
        const { Graphics: MockGraphics } = await import('pixi.js')
        const highlight = new MockGraphics() as MockGraphicsShape
        const outline = { color: 0x123456, alpha: 0.5, width: 3 }

        drawCardHighlight(highlight, 200, 300, outline)
        drawCardHighlight(highlight, 200, 300, outline)

        expect(highlight.roundRects).toHaveLength(1)
        expect(highlight.strokes).toHaveLength(1)
    })
})

describe('createCard', () => {
    it('builds a card carrying its frame name, with its shadow, sprite and hover outline grouped in a liftable body', () => {
        const card = buildCard()

        expect(card.imageUrl).toBe('card-a')
        expect(card.eventMode).toBe('static')
        expect(card.cursor).toBe('grab')
        expect(card.children).toEqual([card.body])
        expect(card.body.children).toEqual([card.shadow, card.innerSprite, card.highlight])
        expect(card.lift.progress).toBe(0)
    })

    it('pins bounds and hit area to the resting card, so the lift never changes stacking or clamping', () => {
        const card = buildCard()

        expect(card.boundsArea).toMatchObject({ x: 0, y: 0, width: 200, height: 300 })
        expect(card.hitArea).toBe(card.boundsArea)
        expect(card.interactiveChildren).toBe(false)
    })

    it('wires pointerdown to the given callback', () => {
        const onDragStart = vi.fn()
        const card = buildCard('light', onDragStart)

        expect(card.listeners.find((l: Listener): boolean => l.event === 'pointerdown')!.handler).toBe(onDragStart)
    })

    it('outlines the card with the accent color on hover, without lifting it, and hides the outline when the pointer leaves', () => {
        const card = buildCard()
        expect(card.highlight.visible).toBe(false)

        fire(card, 'pointerover')
        expect(card.highlight.visible).toBe(true)
        expect(card.highlight.strokes).toEqual([{ ...getPixiThemeColors('light').card.hoverOutline, alignment: 0 }])
        expect(card.lift.reasons.size).toBe(0)

        fire(card, 'pointerout')
        expect(card.highlight.visible).toBe(false)
    })

    it('reads the dark theme outline from the getResolvedTheme callback given at creation', () => {
        const card = buildCard('dark')

        fire(card, 'pointerover')
        expect(card.highlight.strokes).toEqual([{ ...getPixiThemeColors('dark').card.hoverOutline, alignment: 0 }])
    })

    it('redraws the outline on each hover instead of stacking strokes', () => {
        const card = buildCard()

        fire(card, 'pointerover')
        fire(card, 'pointerout')
        fire(card, 'pointerover')

        expect(card.highlight.strokes).toHaveLength(1)
    })

    it.each(['light', 'dark'] as const)('starts with the %s theme resting halo shadow, unblurred', (theme: 'light' | 'dark') => {
        const card = buildCard(theme)
        const shadowTheme = getPixiThemeColors(theme).card.shadow

        expect(card.shadow.tint).toBe(shadowTheme.color)
        expect(card.shadow.alpha).toBe(shadowTheme.restAlpha)
        expect(card.shadow.y).toBe(REST_SHADOW_OFFSET_Y)
        expect(card.shadow.filters).toEqual([])
    })

    it('builds the resting shadow from stacked translucent rings instead of a blur filter', () => {
        const card = buildCard()

        expect(card.shadow.fills).toHaveLength(REST_SHADOW_LAYERS)
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

    describe('setResolvedTheme', () => {
        it('changes the hover outline drawn on cards created afterwards through loadCards', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            manager.setResolvedTheme('dark')
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]

            fire(cards[0], 'pointerover')
            expect(cards[0].highlight.strokes).toEqual([{ ...getPixiThemeColors('dark').card.hoverOutline, alignment: 0 }])
        })
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

    describe('updateTextures', () => {
        it('swaps each card\'s sprite texture for the frame matching its imageUrl in the new spritesheet', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 }, b: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a', 'b'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as Array<
                Container & { imageUrl: string; innerSprite: { texture: unknown } }
            >
            const newTexture = { width: 200, height: 300 }
            const newSpritesheet = { textures: { a: newTexture, b: newTexture } }

            manager.updateTextures(cards as unknown as Card[], newSpritesheet as unknown as Spritesheet)

            expect(cards[0].innerSprite.texture).toBe(newTexture)
            expect(cards[1].innerSprite.texture).toBe(newTexture)
        })

        it('leaves a card\'s texture untouched when the new spritesheet has no frame for its imageUrl', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as Array<
                Container & { imageUrl: string; innerSprite: { texture: unknown } }
            >
            const originalTexture = cards[0].innerSprite.texture

            manager.updateTextures(cards as unknown as Card[], { textures: {} } as unknown as Spritesheet)

            expect(cards[0].innerSprite.texture).toBe(originalTexture)
        })
    })

    describe('updateShadows', () => {
        it('restyles each card\'s shadow with the newly resolved theme', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]

            manager.setResolvedTheme('dark')
            manager.updateShadows(cards as unknown as Card[])

            const darkShadowTheme = getPixiThemeColors('dark').card.shadow
            expect(cards[0].shadow.tint).toBe(darkShadowTheme.color)
            expect(cards[0].shadow.alpha).toBe(darkShadowTheme.restAlpha)
        })
    })

    describe('updateLifts', () => {
        it('eases a dragged card upward over frames instead of jumping', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]
            cards[0].lift.reasons.add('drag')

            manager.updateLifts(cards as unknown as Card[], 1)

            expect(cards[0].lift.progress).toBeGreaterThan(0)
            expect(cards[0].lift.progress).toBeLessThan(1)
        })

        it('raises the card in a single frame when the user prefers reduced motion', () => {
            vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]
            cards[0].lift.reasons.add('drag')

            manager.updateLifts(cards as unknown as Card[], 1)

            expect(cards[0].lift.progress).toBe(1)
            vi.unstubAllGlobals()
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

            manager.placeCard(card, { x: 15, y: 300 })

            expect(card.x).toBe(15)
            expect(card.y).toBe(300)
        })

        it('clamps a saved position that violates the handle top clearance', () => {
            const card = makeCard('a', 0, 0)

            manager.placeCard(card, { x: 15, y: 0 })

            expect(card.x).toBe(15)
            expect(card.y).toBe(STACK_HANDLE_TOP_CLEARANCE)
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

        it('keeps the handle top clearance when shrinking the window pushes the card toward the top', () => {
            const card = makeCard('a', 100, 100, 200, 300)

            manager.repositionForResize(card, 1, 0.1, 1000, 1000)

            expect(card.y).toBe(STACK_HANDLE_TOP_CLEARANCE)
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

        it('keeps the target below the handle top clearance for a card tall enough that centering alone would violate it', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0)
            // Card height 680 on a 720-tall screen centers at y=20, already under the
            // clearance of 31 before the jitter (-25 here) pushes it further up.
            const tallCard = makeCard('a', 10, 10, 200, 680)

            const [target] = manager.shuffleAndBuildTargets([tallCard])

            expect(target.toY).toBe(STACK_HANDLE_TOP_CLEARANCE)
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
