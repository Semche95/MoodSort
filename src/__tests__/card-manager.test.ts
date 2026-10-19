import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Application, Container, Graphics, Spritesheet, Texture } from 'pixi.js'
import {
    CardManager,
    applyCardHover,
    createCard,
    drawCardHighlight,
    drawCardShadowShape,
    CARD_REFERENCE_WIDTH,
    REST_SHADOW_LAYERS,
    REST_SHADOW_SPREAD,
} from '../features/card/card-manager'
import { REST_SHADOW_OFFSET_Y } from '../features/card/card-lift'
import { STACK_FRAME_CLEARANCE } from '../features/stack/stack'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { Card } from '../types/card.types'
import { CardState } from '../types/card-state.types'
import { Position } from '../types/position.types'
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

/** A card whose size follows its scale, as a Pixi container's does, at 200x300 for scale 1. */
function makeScaledCard(imageUrl: string, x: number, y: number, initialScale: number): Card {
    const scale = { x: initialScale, y: initialScale, set(v: number): void { scale.x = v; scale.y = v } }
    return {
        imageUrl,
        x,
        y,
        scale,
        get width(): number { return 200 * scale.x },
        get height(): number { return 300 * scale.y },
    } as unknown as Card
}

function makeState(order: string[]): CardState {
    return { positions: {}, order, onboardingDismissed: false, stackNames: {}, viewport: null }
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

describe('applyCardHover', () => {
    const outline = { color: 0x123456, alpha: 0.5, width: 3 }

    it('outlines only the hovered card, without lifting it, and hides every other outline', () => {
        const [a, b] = [buildCard(), buildCard()]
        b.highlight.visible = true

        applyCardHover([a, b] as unknown as Card[], a as unknown as Card, outline)

        expect(a.highlight.visible).toBe(true)
        expect(a.highlight.strokes).toEqual([{ ...outline, alignment: 0 }])
        expect(a.lift.reasons.size).toBe(0)
        expect(b.highlight.visible).toBe(false)
    })

    it('hides every outline when no card is hovered', () => {
        const card = buildCard()
        card.highlight.visible = true

        applyCardHover([card] as unknown as Card[], null, outline)

        expect(card.highlight.visible).toBe(false)
    })

    it('draws the outline once as it appears, not again on every frame it stays hovered', () => {
        const card = buildCard()

        applyCardHover([card] as unknown as Card[], card as unknown as Card, outline)
        applyCardHover([card] as unknown as Card[], card as unknown as Card, { ...outline, color: 0x654321 })

        expect(card.highlight.strokes).toEqual([{ ...outline, alignment: 0 }])
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

    it('starts with its hover outline hidden and listens to no hover event of its own', () => {
        const card = buildCard()

        expect(card.highlight.visible).toBe(false)
        expect(card.listeners.map((l: Listener): string => l.event)).toEqual(['pointerdown'])
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

    describe('updateHover', () => {
        it('outlines the hovered card in the current resolved theme', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            manager.setResolvedTheme('dark')
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet)

            manager.updateHover(cards, cards[0])

            const highlight = (cards[0] as unknown as CardShape).highlight
            expect(highlight.visible).toBe(true)
            expect(highlight.strokes).toEqual([{ ...getPixiThemeColors('dark').card.hoverOutline, alignment: 0 }])
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
            const cards = manager.loadCards(['a', 'b'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards.map((c: Card): string => c.imageUrl)).toEqual(['a', 'b'])
            expect(cardLayer.children).toEqual(cards)
        })

        it('places a card at its saved position when one exists', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], { a: { x: 42, y: 84 } }, null, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards[0].x).toBe(42)
            expect(cards[0].y).toBe(84)
        })

        it('rescales restored stacks from the canvas size they were saved under', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 }, b: { width: 200, height: 300 } } }
            const positions = { a: { x: 200, y: 100 }, b: { x: 240, y: 160 } }
            const cards = manager.loadCards(['a', 'b'], positions, { width: 2560, height: 1440 }, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards.map((c: Card): Position => ({ x: c.x, y: c.y }))).toEqual([{ x: 100, y: 50 }, { x: 120, y: 80 }])
        })

        it('clamps a restored stack as a whole when no saved canvas size is known', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 }, b: { width: 200, height: 300 } } }
            const positions = { a: { x: 1050, y: 100 }, b: { x: 1100, y: 100 } }
            const cards = manager.loadCards(['a', 'b'], positions, null, vi.fn(), spritesheet as unknown as Spritesheet)

            expect(cards.map((c: Card): number => c.x)).toEqual([1030, 1080])
        })

        it('centers a card added since the last save without rescaling it like the restored ones', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5)
            const spritesheet = { textures: { a: { width: 200, height: 300 }, b: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a', 'b'], { a: { x: 200, y: 100 } }, { width: 2560, height: 1440 }, vi.fn(), spritesheet as unknown as Spritesheet)

            expect({ x: cards[1].x, y: cards[1].y }).toEqual({ x: (app.screen.width - 200) / 2, y: (app.screen.height - 300) / 2 })
            vi.restoreAllMocks()
        })

        it('centers a card with jitter when it has no saved position', () => {
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet)

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
            const cards = manager.loadCards(['a', 'b'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as Array<
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
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as Array<
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
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]

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
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]
            cards[0].lift.reasons.add('drag')

            manager.updateLifts(cards as unknown as Card[], 1)

            expect(cards[0].lift.progress).toBeGreaterThan(0)
            expect(cards[0].lift.progress).toBeLessThan(1)
        })

        it('raises the card in a single frame when the user prefers reduced motion', () => {
            vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
            const spritesheet = { textures: { a: { width: 200, height: 300 } } }
            const cards = manager.loadCards(['a'], {}, null, vi.fn(), spritesheet as unknown as Spritesheet) as unknown as CardShape[]
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

        it('leaves a saved position unclamped, since loadCards clamps restored stacks as a whole', () => {
            const card = makeCard('a', 0, 0)

            manager.placeCard(card, { x: 15, y: 0 })

            expect(card.x).toBe(15)
            expect(card.y).toBe(0)
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

    describe('rescaleStacks', () => {
        it('rescales every card to the current canvas width', () => {
            const card = makeCard('a', 100, 100)

            manager.rescaleStacks([[card]], 2, 2)

            expect(card.scale.set).toHaveBeenCalledWith(app.screen.width / CARD_REFERENCE_WIDTH)
        })

        it('moves the stack origin with the height ratio but keeps the gaps between its cards, which follow the card scale', () => {
            const a = makeCard('a', 100, 100)
            const b = makeCard('b', 140, 160)

            manager.rescaleStacks([[a, b]], 1, 0.5)

            expect({ x: a.x, y: a.y }).toEqual({ x: 100, y: 50 })
            expect({ x: b.x, y: b.y }).toEqual({ x: 140, y: 110 })
        })

        it('scales the vertical gaps between cards with the width ratio, like the cards themselves', () => {
            const a = makeCard('a', 400, 200)
            const b = makeCard('b', 440, 260)

            manager.rescaleStacks([[a, b]], 0.5, 1)

            expect({ x: a.x, y: a.y }).toEqual({ x: 200, y: 200 })
            expect({ x: b.x, y: b.y }).toEqual({ x: 220, y: 230 })
        })

        it('clamps a stack pushed past an edge as a whole, keeping its shape', () => {
            const a = makeCard('a', 1050, 100)
            const b = makeCard('b', 1100, 100)

            manager.rescaleStacks([[a, b]], 1, 1)

            expect(a.x).toBe(1030)
            expect(b.x).toBe(1080)
        })

        it('clamps each card of a stack taller than the canvas, so none ends up off-canvas', () => {
            const a = makeCard('a', 100, 40)
            const b = makeCard('b', 100, 400)

            manager.rescaleStacks([[a, b]], 1, 1)

            for (const card of [a, b]) {
                expect(card.y).toBeGreaterThanOrEqual(STACK_FRAME_CLEARANCE)
                expect(card.y + card.height).toBeLessThanOrEqual(app.screen.height - STACK_FRAME_CLEARANCE)
            }
        })

        it('clamps each stack on its own, leaving a stack already inside the canvas where the ratios put it', () => {
            const inside = makeCard('a', 100, 100)
            const pastEdge = makeCard('b', 1200, 100)

            manager.rescaleStacks([[inside], [pastEdge]], 1, 1)

            expect(inside.x).toBe(100)
            expect(pastEdge.x).toBe(app.screen.width - pastEdge.width)
        })
    })

    describe('rescaleFromViewport', () => {
        it('rescales stacks by the ratio between the current canvas and the saved size', () => {
            const a = makeCard('a', 200, 100)
            const b = makeCard('b', 240, 160)

            manager.rescaleFromViewport([a, b], { width: 2560, height: 1440 })

            expect({ x: a.x, y: a.y }).toEqual({ x: 100, y: 50 })
            expect({ x: b.x, y: b.y }).toEqual({ x: 120, y: 80 })
        })

        it('only clamps stacks as a whole when the saved size is unknown', () => {
            const inside = makeCard('a', 100, 100)
            const a = makeCard('b', 1050, 100)
            const b = makeCard('c', 1100, 100)

            manager.rescaleFromViewport([inside, a, b], null)

            expect({ x: inside.x, y: inside.y }).toEqual({ x: 100, y: 100 })
            expect(a.x).toBe(1030)
            expect(b.x).toBe(1080)
        })

        it('keeps together a pile whose cards only overlap at the card scale of the saved size', () => {
            const currentScale = app.screen.width / CARD_REFERENCE_WIDTH
            const a = makeScaledCard('a', 100, 100, currentScale)
            const b = makeScaledCard('b', 100, 300, currentScale)

            manager.rescaleFromViewport([a, b], { width: 2560, height: 720 })

            expect({ x: b.x, y: b.y }).toEqual({ x: 50, y: 200 })
            expect(b.y).toBeLessThan(a.y + a.height)
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

            expect(target.toY).toBe(STACK_FRAME_CLEARANCE)
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
