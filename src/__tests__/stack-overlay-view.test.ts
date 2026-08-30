import { describe, expect, it, vi } from 'vitest'
import type { Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import {
    drawArrow,
    drawCompactButton,
    drawCompactIcon,
    drawGripIcon,
    drawMergeDim,
    drawMergePlus,
    drawMergeTargetBorder,
    drawSingleBox,
    drawSingleStack,
} from '../features/stack/stack-overlay/stack-overlay-view'

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

describe('stack-overlay-view', () => {
    it('drawSingleBox draws a padded border and a centered handle above it', () => {
        const border = makeGraphics()
        const handle = makeGraphics()

        drawSingleBox({ x: 100, y: 100, width: 200, height: 300 }, border, handle)

        const rectCall = border.calls.find((c: Call): boolean => c.method === 'rect')!
        expect(rectCall.args).toEqual([80, 80, 240, 340])
        expect(handle.calls.some((c: Call): boolean => c.method === 'roundRect')).toBe(true)
        expect(handle.calls.some((c: Call): boolean => c.method === 'rect')).toBe(true)
    })

    it('drawSingleStack derives the box from the stack cards before drawing', () => {
        const border = makeGraphics()
        const handle = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(50, 50, 100, 100, 'b')]

        drawSingleStack(stack, border, handle)

        const rectCall = border.calls.find((c: Call): boolean => c.method === 'rect')!
        expect(rectCall.args).toEqual([-20, -20, 190, 190])
    })

    it('drawGripIcon draws three horizontal bars centered on the handle', () => {
        const handle = makeGraphics()

        drawGripIcon(0, 0, 80, handle)

        const rects = handle.calls.filter((c: Call): boolean => c.method === 'rect')
        expect(rects).toHaveLength(3)
    })

    it('drawCompactButton draws nothing for a lone single-card stack', () => {
        const compactButton = makeGraphics()

        drawCompactButton([makeCard(0, 0, 100, 100, 'a')], compactButton)

        expect(compactButton.calls).toHaveLength(0)
    })

    it('drawCompactButton draws a rounded button with the converging-arrows icon for a multi-card stack', () => {
        const compactButton = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(50, 50, 100, 100, 'b')]

        drawCompactButton(stack, compactButton)

        expect(compactButton.calls.some((c: Call): boolean => c.method === 'roundRect')).toBe(true)
        expect(compactButton.calls.filter((c: Call): boolean => c.method === 'moveTo')).toHaveLength(4)
    })

    it('drawCompactIcon draws two arrows scaled to the button rect', () => {
        const compactButton = makeGraphics()

        drawCompactIcon({ x: 0, y: 0, width: 24, height: 24 }, compactButton)

        expect(compactButton.calls.filter((c: Call): boolean => c.method === 'moveTo')).toHaveLength(4)
        expect(compactButton.calls.filter((c: Call): boolean => c.method === 'closePath')).toHaveLength(4)
    })

    it('drawArrow draws a filled shaft and arrowhead pointing from "from" to "to"', () => {
        const icon = makeGraphics()

        drawArrow(icon, { x: 0, y: 0 }, { x: 10, y: 0 }, 2)

        expect(icon.calls.filter((c: Call): boolean => c.method === 'moveTo')).toHaveLength(2)
        expect(icon.calls.filter((c: Call): boolean => c.method === 'closePath')).toHaveLength(2)
        expect(icon.calls.filter((c: Call): boolean => c.method === 'fill')).toHaveLength(2)
    })

    it('drawMergeTargetBorder draws a padded border around the stack', () => {
        const mergeIndicator = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a')]

        drawMergeTargetBorder(stack, mergeIndicator)

        expect(mergeIndicator.calls.some((c: Call): boolean => c.method === 'stroke')).toBe(true)
    })

    it('drawMergeDim fills a dim overlay over the stack area', () => {
        const mergeIndicator = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a')]

        drawMergeDim(stack, mergeIndicator)

        const fillCall = mergeIndicator.calls.find((c: Call): boolean => c.method === 'fill')!
        expect(fillCall.args).toEqual([{ color: 0x000000, alpha: 0.15 }])
    })

    it('drawMergePlus draws a centered plus sign over the stack', () => {
        const mergePlus = makeGraphics()
        const stack = [makeCard(0, 0, 100, 100, 'a')]

        drawMergePlus(stack, mergePlus)

        expect(mergePlus.calls.filter((c: Call): boolean => c.method === 'rect')).toHaveLength(2)
    })
})
