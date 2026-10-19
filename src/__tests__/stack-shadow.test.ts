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
    },
    BlurFilter: class MockBlurFilter { strength: number = 0 },
    AlphaFilter: class MockAlphaFilter { alpha: number = 1 },
    Container: class MockContainer {},
    Rectangle: class MockRectangle {},
    Sprite: class MockSprite {},
}))

type MockShadowGraphics = { rects: number[][]; fills: Array<{ color: number; alpha?: number }>; tint: number; eventMode: string; filters: unknown[] }

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

    it('replaces the previous frame\'s shapes instead of piling them up', () => {
        const shadow = createStackShadow(getPixiThemeColors('light').card.stackShadow)
        const graphics = shadow.graphics as unknown as MockShadowGraphics
        const cards = [makeCard(10, 20)]

        drawStackShadow(shadow, cards)
        drawStackShadow(shadow, cards)

        expect(graphics.rects).toHaveLength(1)
    })
})
