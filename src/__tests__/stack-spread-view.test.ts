import { describe, expect, it, vi } from 'vitest'
import type { Graphics, Texture } from 'pixi.js'
import {
    createSpreadItem,
    drawSpreadItem,
    drawSpreadPill,
    drawSpreadScrollbar,
    drawSpreadVeil,
} from '../features/stack/stack-spread/stack-spread-view'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { REST_SHADOW_OFFSET_Y } from '../features/card/card-lift'
import { MockGraphics, MockRectangle } from './spread-pixi-mock'

vi.mock('pixi.js', async () => (await import('./spread-pixi-mock')).spreadPixiMock)

type Call = { method: string; args: unknown[] }

const dark = getPixiThemeColors('dark')
const texture = { width: 256, height: 382 } as unknown as Texture

function calls(g: unknown, method: string): Call[] {
    return (g as MockGraphics).calls.filter((call: Call): boolean => call.method === method)
}

describe('createSpreadItem', () => {
    it('builds a grabbable cell, shadow under sprite under a hidden outline, bound to no card yet', () => {
        const item = createSpreadItem()

        expect(item.view.eventMode).toBe('static')
        expect(item.view.cursor).toBe('grab')
        expect(item.view.children).toEqual([item.shadow, item.sprite, item.highlight])
        expect(item.highlight.visible).toBe(false)
        expect(item.card).toBeNull()
    })
})

describe('drawSpreadItem', () => {
    it('scales the card look onto its cell, with the resting shadow of the theme', () => {
        const item = createSpreadItem()

        drawSpreadItem(item, { x: 40, y: 60, width: 128, height: 191 }, texture, false, dark.card)

        expect({ x: item.view.x, y: item.view.y, scale: item.view.scale.x }).toEqual({ x: 40, y: 60, scale: 0.5 })
        expect(item.view.hitArea).toEqual(new MockRectangle(0, 0, 256, 382))
        expect(item.sprite.texture).toBe(texture)
        expect(item.shadow.tint).toBe(dark.card.shadow.color)
        expect(item.shadow.alpha).toBe(dark.card.shadow.restAlpha)
        expect(item.shadow.y).toBe(REST_SHADOW_OFFSET_Y)
        expect(item.highlight.visible).toBe(false)
        expect(item.view.visible).toBe(true)
    })

    it('outlines a hovered card at the board outline width once scaled down', () => {
        const item = createSpreadItem()

        drawSpreadItem(item, { x: 0, y: 0, width: 128, height: 191 }, texture, true, dark.card)

        expect(item.highlight.visible).toBe(true)
        const stroke = calls(item.highlight, 'stroke')[0].args[0] as { color: number; width: number }
        expect(stroke.color).toBe(dark.card.hoverOutline.color)
        expect(stroke.width).toBe(dark.card.hoverOutline.width * 2)
    })
})

describe('drawSpreadVeil', () => {
    it('washes the whole canvas with the background color, translucent', () => {
        const g = new MockGraphics()

        drawSpreadVeil(g as unknown as Graphics, { width: 800, height: 600 }, dark)

        expect(calls(g, 'rect')[0].args).toEqual([0, 0, 800, 600])
        const fill = calls(g, 'fill')[0].args[0] as { color: number; alpha: number }
        expect(fill.color).toBe(dark.canvasBackground)
        expect(fill.alpha).toBeGreaterThan(0.5)
        expect(fill.alpha).toBeLessThan(1)
    })
})

describe('drawSpreadScrollbar', () => {
    const scrollbar = {
        track: { x: 790, y: 112, width: 4, height: 400 },
        thumb: { x: 790, y: 212, width: 4, height: 100 },
        hitArea: { x: 784, y: 112, width: 16, height: 400 },
    }

    it('draws a faint track and a stronger thumb, taking the pointer on the wider strip', () => {
        const g = new MockGraphics()

        drawSpreadScrollbar(g as unknown as Graphics, scrollbar, dark.stackOverlay)

        expect(calls(g, 'roundRect').map((call: Call): unknown[] => call.args.slice(0, 4))).toEqual([[790, 112, 4, 400], [790, 212, 4, 100]])
        const [track, thumb] = calls(g, 'fill').map((call: Call): { alpha: number } => call.args[0] as { alpha: number })
        expect(track.alpha).toBeLessThan(thumb.alpha)
        expect(g.hitArea).toEqual(new MockRectangle(784, 112, 16, 400))
    })

    it('draws nothing and takes no pointer without a scrollbar', () => {
        const g = new MockGraphics()
        drawSpreadScrollbar(g as unknown as Graphics, scrollbar, dark.stackOverlay)

        drawSpreadScrollbar(g as unknown as Graphics, null, dark.stackOverlay)

        expect(g.calls[g.calls.length - 1].method).toBe('clear')
        expect(g.hitArea).toBeNull()
    })
})

describe('drawSpreadPill', () => {
    const layout = {
        pill: { x: 300, y: 72, width: 200, height: 32 },
        label: { x: 320, y: 88 },
        close: { x: 466, y: 72, width: 30, height: 32 },
    }

    it('draws the pill and a close cross in the icon color, the cross taking the pointer on its slot', () => {
        const pill = new MockGraphics()
        const close = new MockGraphics()

        drawSpreadPill(pill as unknown as Graphics, close as unknown as Graphics, layout, false, dark.stackOverlay)

        expect(calls(pill, 'roundRect')).toHaveLength(2)
        expect(calls(close, 'circle')).toHaveLength(0)
        expect((calls(close, 'stroke')[0].args[0] as { color: number }).color).toBe(dark.stackOverlay.controlIcon)
        expect(close.hitArea).toEqual(new MockRectangle(466, 72, 30, 32))
    })

    it('lights the close button with a chip and the accent while hovered', () => {
        const pill = new MockGraphics()
        const close = new MockGraphics()

        drawSpreadPill(pill as unknown as Graphics, close as unknown as Graphics, layout, true, dark.stackOverlay)

        expect(calls(close, 'circle')).toHaveLength(1)
        expect((calls(close, 'stroke')[0].args[0] as { color: number }).color).toBe(dark.stackOverlay.accent)
    })
})
