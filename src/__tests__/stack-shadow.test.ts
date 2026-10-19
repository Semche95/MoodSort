import { describe, it, expect, vi } from 'vitest'
import { applyStackShadowTheme, createStackShadow, drawStackShadow, STACK_SHADOW_OFFSET_Y } from '../features/stack/stack-shadow'
import { createCardLift } from '../features/card/card-lift'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { Card } from '../types/card.types'
import { CARD_CORNER_RADIUS } from '../features/card/card-corner-radius'

vi.mock('pixi.js', () => ({
    Graphics: class MockGraphics {
        label: string = ''
        eventMode: string = 'auto'
        tint: number = 0xffffff
        filters: unknown[] = []
        rects: number[][] = []
        fills: Array<{ color: number; alpha?: number }> = []
        clear(): this {
            this.rects = []
            this.fills = []
            return this
        }
        roundRect(...args: number[]): this {
            this.rects.push(args)
            return this
        }
        fill(style: { color: number; alpha?: number }): this {
            this.fills.push(style)
            return this
        }
        getLocalBounds(): { x: number; y: number; width: number; height: number } {
            const xs = this.rects.map((r: number[]): number => r[0])
            const ys = this.rects.map((r: number[]): number => r[1])
            const x = Math.min(...xs)
            const y = Math.min(...ys)
            return {
                x,
                y,
                width: Math.max(...this.rects.map((r: number[]): number => r[0] + r[2])) - x,
                height: Math.max(...this.rects.map((r: number[]): number => r[1] + r[3])) - y,
            }
        }
    },
    BlurFilter: class MockBlurFilter { strength: number = 0; padding: number = 12 },
    AlphaFilter: class MockAlphaFilter { alpha: number = 1 },
    Container: class MockContainer {
        label: string = ''
        eventMode: string = 'auto'
        children: unknown[] = []
        cached: boolean = false
        cacheUpdates: number = 0
        boundsArea: unknown = null
        addChild(child: unknown): unknown {
            this.children.push(child)
            return child
        }
        cacheAsTexture(enabled: boolean): void {
            this.cached = enabled
        }
        updateCacheTexture(): void {
            this.cacheUpdates++
        }
    },
    Rectangle: class MockRectangle {
        x: number
        y: number
        width: number
        height: number
        constructor(x: number, y: number, width: number, height: number) {
            this.x = x
            this.y = y
            this.width = width
            this.height = height
        }
    },
    Sprite: class MockSprite {},
}))

type MockShadowGraphics = { rects: number[][]; fills: Array<{ color: number; alpha?: number }>; tint: number; eventMode: string; filters: unknown[] }
type MockShadowView = { children: unknown[]; eventMode: string; cached: boolean; cacheUpdates: number; boundsArea: { x: number; y: number; width: number; height: number } | null }

function makeCard(x: number, y: number, scale: number = 0.5): Card {
    return { x, y, width: 100, height: 150, scale: { x: scale }, lift: createCardLift() } as unknown as Card
}

describe('createStackShadow', () => {
    it('fades the shadow as a whole, blurs it, and lets pointer events through', () => {
        const palette = getPixiThemeColors('light').card.stackShadow
        const shadow = createStackShadow(palette)
        const graphics = shadow.graphics as unknown as MockShadowGraphics

        expect(graphics.filters).toEqual([shadow.alpha, shadow.blur])
        expect(graphics.eventMode).toBe('none')
        expect(graphics.tint).toBe(palette.color)
    })

    it('renders the blurred shadow into a cached view that lets pointer events through', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const view = shadow.view as unknown as MockShadowView

        expect(view.children).toEqual([shadow.graphics])
        expect(view.cached).toBe(true)
        expect(view.eventMode).toBe('none')
    })
})

describe('applyStackShadowTheme', () => {
    it('retunes color, opacity and blur in place for the new theme', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const dark = getPixiThemeColors('dark').card.stackShadow

        applyStackShadowTheme(shadow, dark)

        expect(shadow.graphics.tint).toBe(dark.color)
        expect(shadow.alpha.alpha).toBe(dark.alpha)
        expect(shadow.blur.strength).toBe(dark.blurStrength)
    })

    it('makes the next draw refresh the cached shadow even if no card moved', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const view = shadow.view as unknown as MockShadowView
        const cards = [makeCard(10, 20)]
        drawStackShadow(shadow, cards)

        applyStackShadowTheme(shadow, getPixiThemeColors('dark').card.stackShadow)
        drawStackShadow(shadow, cards)

        expect(view.cacheUpdates).toBe(2)
    })
})

describe('drawStackShadow', () => {
    it('draws one shape per card, offset below it, all in a single opaque fill so overlaps never darken', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const graphics = shadow.graphics as unknown as MockShadowGraphics

        drawStackShadow(shadow, [makeCard(10, 20), makeCard(30, 40)])

        expect(graphics.rects).toEqual([
            [10, 20 + STACK_SHADOW_OFFSET_Y * 0.5, 100, 150, CARD_CORNER_RADIUS * 0.5],
            [30, 40 + STACK_SHADOW_OFFSET_Y * 0.5, 100, 150, CARD_CORNER_RADIUS * 0.5],
        ])
        expect(graphics.fills).toEqual([{ color: 0xFFFFFF }])
    })

    it('leaves out a dragged card, which casts its own lifted shadow instead', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const graphics = shadow.graphics as unknown as MockShadowGraphics
        const dragged = makeCard(30, 40)
        dragged.lift.reasons.add('drag')

        drawStackShadow(shadow, [makeCard(10, 20), dragged])

        expect(graphics.rects).toHaveLength(1)
    })

    it('replaces the previous shapes instead of piling them up', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const graphics = shadow.graphics as unknown as MockShadowGraphics
        const card = makeCard(10, 20)

        drawStackShadow(shadow, [card])
        card.x = 50
        drawStackShadow(shadow, [card])

        expect(graphics.rects).toEqual([[50, 20 + STACK_SHADOW_OFFSET_Y * 0.5, 100, 150, CARD_CORNER_RADIUS * 0.5]])
    })

    it('keeps the cached shadow while no card moved', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const view = shadow.view as unknown as MockShadowView
        const cards = [makeCard(10, 20)]
        drawStackShadow(shadow, cards)
        const roundRect = vi.spyOn(shadow.graphics, 'roundRect')

        drawStackShadow(shadow, cards)

        expect(roundRect).not.toHaveBeenCalled()
        expect(view.cacheUpdates).toBe(1)
    })

    it('redraws once a card starts being dragged, since it then casts its own shadow', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const graphics = shadow.graphics as unknown as MockShadowGraphics
        const card = makeCard(10, 20)
        drawStackShadow(shadow, [makeCard(30, 40), card])

        card.lift.reasons.add('drag')
        drawStackShadow(shadow, [makeCard(30, 40), card])

        expect(graphics.rects).toHaveLength(1)
    })

    it('widens the cached area by the blur padding so the blur is never clipped', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const view = shadow.view as unknown as MockShadowView
        const padding = shadow.blur.padding

        drawStackShadow(shadow, [makeCard(10, 20), makeCard(30, 40)])

        const top = 20 + STACK_SHADOW_OFFSET_Y * 0.5
        expect(view.boundsArea).toEqual({ x: 10 - padding, y: top - padding, width: 120 + padding * 2, height: 40 + 150 - 20 + padding * 2 })
    })
})
