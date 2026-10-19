import { describe, expect, it, vi } from 'vitest'
import type { Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import {
    drawArrow,
    drawCompactButton,
    drawCompactIcon,
    drawControlHover,
    drawGripIcon,
    drawMergePlus,
    drawMergeWash,
    drawNameButton,
    drawNameIcon,
    drawPillShape,
    drawStackFrame,
    drawStackPill,
    roundRectOutline,
    traceDashedPath,
} from '../features/stack/stack-overlay/stack-overlay-view'
import { computeStackPillLayout } from '../features/stack/stack-hit-testing'
import { STACK_PILL_HEIGHT } from '../features/stack/stack'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'

type Call = { method: string; args: unknown[] }

const { pixi } = vi.hoisted(() => {
    class Graphics {
        calls: Array<{ method: string; args: unknown[] }> = []
        clear(): this { this.calls.push({ method: 'clear', args: [] }); return this }
        roundRect(...args: unknown[]): this { this.calls.push({ method: 'roundRect', args }); return this }
        rect(...args: unknown[]): this { this.calls.push({ method: 'rect', args }); return this }
        fill(...args: unknown[]): this { this.calls.push({ method: 'fill', args }); return this }
        stroke(...args: unknown[]): this { this.calls.push({ method: 'stroke', args }); return this }
        moveTo(...args: unknown[]): this { this.calls.push({ method: 'moveTo', args }); return this }
        lineTo(...args: unknown[]): this { this.calls.push({ method: 'lineTo', args }); return this }
        closePath(...args: unknown[]): this { this.calls.push({ method: 'closePath', args }); return this }
        circle(...args: unknown[]): this { this.calls.push({ method: 'circle', args }); return this }
    }

    return { pixi: { Graphics } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

function makeGraphics(): Graphics & { calls: Call[] } {
    return new pixi.Graphics() as unknown as Graphics & { calls: Call[] }
}

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height, alpha: 1 } as unknown as Card
}

function calls(g: { calls: Call[] }, method: string): Call[] {
    return g.calls.filter((c: Call): boolean => c.method === method)
}

const lightPalette = getPixiThemeColors('light').stackOverlay
const darkPalette = getPixiThemeColors('dark').stackOverlay
const frame = { x: 0, y: 0, width: 200, height: 100 }

describe('roundRectOutline', () => {
    it('starts and ends on the top edge, just past the top-left corner', () => {
        const points = roundRectOutline(frame, 10)

        expect(points[0]).toEqual({ x: 10, y: 0 })
        expect(points[points.length - 1]).toEqual({ x: 10, y: 0 })
    })

    it('stays within the rectangle and reaches each straight edge', () => {
        const points = roundRectOutline(frame, 10)

        expect(points.every((p: { x: number; y: number }): boolean => p.x >= -1e-9 && p.x <= 200 + 1e-9 && p.y >= -1e-9 && p.y <= 100 + 1e-9)).toBe(true)
        expect(points.some((p: { x: number }): boolean => Math.abs(p.x - 200) < 1e-9)).toBe(true)
        expect(points.some((p: { y: number }): boolean => Math.abs(p.y - 100) < 1e-9)).toBe(true)
    })
})

describe('traceDashedPath', () => {
    it('fits a whole number of dashes on the path, so a closed outline never ends on a stub', () => {
        const g = makeGraphics()

        // 100px with a 6+5 pattern: rounded to 9 periods, each stretched to 100/9.
        traceDashedPath(g, [{ x: 0, y: 0 }, { x: 100, y: 0 }], 6, 5)

        const moves = calls(g, 'moveTo')
        const lines = calls(g, 'lineTo')
        expect(moves).toHaveLength(9)
        const period = 100 / 9
        expect(moves[1].args[0]).toBeCloseTo(period)
        expect(lines[0].args[0]).toBeCloseTo(period * (6 / 11))
    })

    it('carries a dash across a corner of the polyline instead of restarting it', () => {
        const g = makeGraphics()

        traceDashedPath(g, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 8 }], 6, 5)

        // The first dash runs 3px along the first segment, then continues 3px down the second.
        expect(calls(g, 'moveTo')[1].args).toEqual([3, 0])
        expect(calls(g, 'lineTo')[1].args[1]).toBeCloseTo(3)
    })

    it('draws nothing for a zero-length path', () => {
        const g = makeGraphics()

        traceDashedPath(g, [{ x: 5, y: 5 }, { x: 5, y: 5 }], 6, 5)

        expect(g.calls).toHaveLength(0)
    })
})

describe('stack-overlay-view', () => {
    it('drawStackFrame strokes a dashed rounded frame in the frame color at rest', () => {
        const g = makeGraphics()

        drawStackFrame(g, frame, false, darkPalette)

        expect(calls(g, 'roundRect')[0].args).toEqual([0, 0, 200, 100, 24])
        expect(calls(g, 'moveTo').length).toBeGreaterThan(10)
        expect((calls(g, 'stroke')[0].args[0] as { color: number }).color).toBe(darkPalette.frame)
    })

    it('drawStackFrame switches to the accent, with a light accent wash, while highlighted', () => {
        const g = makeGraphics()

        drawStackFrame(g, frame, true, darkPalette)

        expect((calls(g, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.accent)
        expect((calls(g, 'stroke')[0].args[0] as { color: number }).color).toBe(darkPalette.accent)
    })

    it('drawPillShape draws a shadow offset below the pill, then the pill itself', () => {
        const g = makeGraphics()

        drawPillShape(g, { x: 10, y: 20, width: 60, height: STACK_PILL_HEIGHT }, darkPalette)

        const [shadow, pill] = calls(g, 'roundRect')
        expect(shadow.args[1]).toBeGreaterThan(20)
        expect(pill.args).toEqual([10, 20, 60, STACK_PILL_HEIGHT, STACK_PILL_HEIGHT / 2])
        const fills = calls(g, 'fill').map((c: Call): number => (c.args[0] as { color: number }).color)
        expect(fills).toEqual([darkPalette.pillShadow, darkPalette.pill])
    })

    it('drawStackPill draws the pill and its grip', () => {
        const g = makeGraphics()

        drawStackPill(g, computeStackPillLayout(frame, null), false, lightPalette)

        expect(calls(g, 'roundRect')).toHaveLength(2)
        expect(calls(g, 'circle')).toHaveLength(6)
        expect((calls(g, 'fill').pop()!.args[0] as { color: number }).color).toBe(lightPalette.controlIcon)
    })

    it('drawStackPill lights the grip with a hover chip behind accent dots', () => {
        const g = makeGraphics()
        const layout = computeStackPillLayout(frame, null)

        drawStackPill(g, layout, true, lightPalette)

        const [chip] = calls(g, 'circle')
        expect(chip.args).toEqual([layout.grip.x + layout.grip.width / 2, layout.grip.y + layout.grip.height / 2, expect.any(Number)])
        expect(calls(g, 'circle')).toHaveLength(7)
        const fills = calls(g, 'fill').map((c: Call): number => (c.args[0] as { color: number }).color)
        expect(fills.slice(-2)).toEqual([lightPalette.controlHover, lightPalette.accent])
    })

    it('drawGripIcon draws six dots centered on the grip slot', () => {
        const g = makeGraphics()

        drawGripIcon({ x: 0, y: 0, width: 26, height: 30 }, g)

        const dots = calls(g, 'circle')
        expect(dots).toHaveLength(6)
        const xs = dots.map((c: Call): number => c.args[0] as number)
        const ys = dots.map((c: Call): number => c.args[1] as number)
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(13)
        expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(15)
    })

    it('drawGripIcon fills its dots with the given color, the control icon color by default', () => {
        const plain = makeGraphics()
        const tinted = makeGraphics()

        drawGripIcon({ x: 0, y: 0, width: 26, height: 30 }, plain, darkPalette)
        drawGripIcon({ x: 0, y: 0, width: 26, height: 30 }, tinted, darkPalette, darkPalette.accent)

        expect((calls(plain, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.controlIcon)
        expect((calls(tinted, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.accent)
    })

    it('drawNameButton fades the pencil at rest and shows it fully while hovered', () => {
        const layout = computeStackPillLayout(frame, 40)
        const rest = makeGraphics()
        const hovered = makeGraphics()

        drawNameButton(layout, rest, false, false, darkPalette)
        drawNameButton(layout, hovered, true, false, darkPalette)

        const iconAlpha = (g: { calls: Call[] }): number => (calls(g, 'fill').pop()!.args[0] as { alpha: number }).alpha
        expect(iconAlpha(rest)).toBeLessThan(iconAlpha(hovered))
        expect(calls(hovered, 'circle')).toHaveLength(0)
        expect(calls(rest, 'rect')[0].args).toEqual([layout.pencil.x, layout.pencil.y, layout.pencil.width, layout.pencil.height])
    })

    it('drawNameButton puts an accent pencil on a hover chip centered on its slot while the button itself is hovered', () => {
        const layout = computeStackPillLayout(frame, 40)
        const g = makeGraphics()

        drawNameButton(layout, g, true, true, darkPalette)

        const { pencil } = layout
        const chip = calls(g, 'circle')
        expect(chip).toHaveLength(1)
        expect(chip[0].args.slice(0, 2)).toEqual([pencil.x + pencil.width / 2, pencil.y + pencil.height / 2])
        const fills = calls(g, 'fill').map((c: Call): number => (c.args[0] as { color: number }).color)
        expect(fills[1]).toBe(darkPalette.controlHover)
        expect(fills.pop()).toBe(darkPalette.accent)
    })

    it('drawControlHover draws a round chip centered on the slot in the hover color', () => {
        const g = makeGraphics()

        drawControlHover({ x: 10, y: 20, width: 30, height: 32 }, g, darkPalette)

        expect(calls(g, 'circle')[0].args.slice(0, 2)).toEqual([25, 36])
        expect((calls(g, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.controlHover)
    })

    it('drawCompactButton draws nothing for a lone single-card stack', () => {
        const compactButton = makeGraphics()

        drawCompactButton([makeCard(0, 0, 100, 100, 'a')], compactButton, false)

        expect(compactButton.calls).toHaveLength(0)
    })

    it('drawCompactButton draws a pill with the converging-arrows icon for a multi-card stack', () => {
        const compactButton = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(50, 50, 100, 100, 'b')]

        drawCompactButton(stack, compactButton, false, darkPalette)

        expect(calls(compactButton, 'roundRect')).toHaveLength(2)
        expect(calls(compactButton, 'moveTo')).toHaveLength(4)
        expect(calls(compactButton, 'circle')).toHaveLength(0)
        expect((calls(compactButton, 'fill').pop()!.args[0] as { color: number }).color).toBe(darkPalette.controlIcon)
    })

    it('drawCompactButton adds a hover chip and tints the arrows with the accent while hovered', () => {
        const compactButton = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(50, 50, 100, 100, 'b')]

        drawCompactButton(stack, compactButton, true, darkPalette)

        expect(calls(compactButton, 'circle')).toHaveLength(1)
        expect((calls(compactButton, 'fill').pop()!.args[0] as { color: number }).color).toBe(darkPalette.accent)
    })

    it('drawCompactIcon draws two arrows scaled to the icon rect', () => {
        const compactButton = makeGraphics()

        drawCompactIcon({ x: 0, y: 0, width: 24, height: 24 }, compactButton, 0x123456)

        expect(calls(compactButton, 'moveTo')).toHaveLength(4)
        expect(calls(compactButton, 'closePath')).toHaveLength(4)
        expect((calls(compactButton, 'fill')[0].args[0] as { color: number }).color).toBe(0x123456)
    })

    it('drawArrow draws a filled shaft and arrowhead pointing from "from" to "to"', () => {
        const icon = makeGraphics()

        drawArrow(icon, { x: 0, y: 0 }, { x: 10, y: 0 }, 2)

        expect(calls(icon, 'moveTo')).toHaveLength(2)
        expect(calls(icon, 'closePath')).toHaveLength(2)
        expect(calls(icon, 'fill')).toHaveLength(2)
    })

    it('drawMergeWash fills the stack frame area with a light accent wash, without any outline', () => {
        const mergeIndicator = makeGraphics()

        drawMergeWash([makeCard(0, 0, 100, 100, 'a')], mergeIndicator, darkPalette)

        expect(calls(mergeIndicator, 'roundRect')[0].args).toEqual([-20, -20, 140, 140, 24])
        expect((calls(mergeIndicator, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.accent)
        expect(calls(mergeIndicator, 'stroke')).toHaveLength(0)
    })

    it('drawMergePlus draws a centered accent plus sign over the stack', () => {
        const mergePlus = makeGraphics()

        drawMergePlus([makeCard(0, 0, 100, 100, 'a')], mergePlus, darkPalette)

        expect(calls(mergePlus, 'roundRect')).toHaveLength(2)
        expect((calls(mergePlus, 'fill')[0].args[0] as { color: number }).color).toBe(darkPalette.accent)
    })

    it('drawNameIcon draws a pencil shaft and tip with the given color and alpha', () => {
        const icon = makeGraphics()

        drawNameIcon({ x: 0, y: 0, width: 24, height: 24 }, icon, 0x123456, 0.5)

        expect(calls(icon, 'moveTo')).toHaveLength(2)
        expect(calls(icon, 'closePath')).toHaveLength(2)
        expect(calls(icon, 'fill')[0].args[0]).toEqual({ color: 0x123456, alpha: 0.5 })
    })
})
