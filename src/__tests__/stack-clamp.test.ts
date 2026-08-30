import { describe, it, expect } from 'vitest'
import { clampCardPosition, computeGroupClampOffset, STACK_HANDLE_TOP_CLEARANCE } from '../features/stack/stack'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

describe('clampCardPosition', () => {
    const appWidth = 800
    const appHeight = 600
    const card = makeCard(0, 0, 50, 50, 'a')

    it('leaves an in-bounds position untouched', () => {
        expect(clampCardPosition(300, 300, card, appWidth, appHeight)).toEqual({ x: 300, y: 300 })
    })

    it('clamps y to the handle top clearance instead of 0', () => {
        expect(clampCardPosition(300, -50, card, appWidth, appHeight)).toEqual({ x: 300, y: STACK_HANDLE_TOP_CLEARANCE })
    })

    it('clamps x and y to the opposite edges', () => {
        expect(clampCardPosition(900, 900, card, appWidth, appHeight)).toEqual({ x: 750, y: 550 })
    })
})

describe('computeGroupClampOffset', () => {
    const appWidth = 800
    const appHeight = 600

    it('returns a zero offset when the group is fully within bounds', () => {
        const cards = [makeCard(100, 100, 50, 50, 'a'), makeCard(150, 150, 50, 50, 'b')]

        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: 0, y: 0 })
    })

    it('pushes the group down to keep the handle clearance at the top edge', () => {
        const cards = [makeCard(100, 0, 50, 50, 'a')]

        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: 0, y: STACK_HANDLE_TOP_CLEARANCE })
    })

    it('pushes the group right when it goes past the left edge', () => {
        const cards = [makeCard(-30, 100, 50, 50, 'a')]

        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: 30, y: 0 })
    })

    it('pushes the group left when it goes past the right edge', () => {
        const cards = [makeCard(780, 100, 50, 50, 'a')]

        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: -30, y: 0 })
    })

    it('pushes the group up when it goes past the bottom edge', () => {
        const cards = [makeCard(100, 580, 50, 50, 'a')]

        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: 0, y: -30 })
    })

    it('applies the same offset to a multi-card group, derived from its combined bounding box', () => {
        const cards = [makeCard(100, -10, 50, 50, 'a'), makeCard(120, 20, 50, 50, 'b')]

        // Bounding box top is -10, so the group must move down by STACK_HANDLE_TOP_CLEARANCE + 10.
        expect(computeGroupClampOffset(cards, appWidth, appHeight)).toEqual({ x: 0, y: STACK_HANDLE_TOP_CLEARANCE + 10 })
    })
})
