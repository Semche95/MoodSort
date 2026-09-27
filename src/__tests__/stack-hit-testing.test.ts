import { describe, it, expect } from 'vitest'
import {
    computeCompactButtonBox,
    findStackByCompactButtonAtPoint,
    computeNameButtonBox,
    findStackByNameButtonAtPoint,
} from '../features/stack/stack-hit-testing'
import {
    STACK_HANDLE_HEIGHT,
    STACK_HIGHLIGHT_PADDING,
    STACK_COMPACT_BUTTON_SIZE,
    STACK_COMPACT_BUTTON_GAP,
    STACK_NAME_BUTTON_SIZE,
    STACK_NAME_BUTTON_GAP,
} from '../features/stack/stack'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

describe('computeCompactButtonBox', () => {
    it('returns null for a single-card stack', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a')]

        expect(computeCompactButtonBox(stack)).toBeNull()
    })

    it('positions a square button next to the drag handle for a multi-card stack', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]

        const pad = STACK_HIGHLIGHT_PADDING
        const bx = -pad
        const by = -pad
        const bw = 110 + pad * 2
        const handleWidth = Math.min(bw, 80)
        const hx = bx + (bw - handleWidth) / 2
        const hy = by - STACK_HANDLE_HEIGHT / 2

        expect(computeCompactButtonBox(stack)).toEqual({
            x: hx + handleWidth + STACK_COMPACT_BUTTON_GAP,
            y: hy + (STACK_HANDLE_HEIGHT - STACK_COMPACT_BUTTON_SIZE) / 2,
            width: STACK_COMPACT_BUTTON_SIZE,
            height: STACK_COMPACT_BUTTON_SIZE,
        })
    })
})

describe('findStackByCompactButtonAtPoint', () => {
    it('returns null when the point is outside every compact button', () => {
        const single = [makeCard(0, 0, 100, 100, 'a')]

        expect(findStackByCompactButtonAtPoint([single], { x: 0, y: 0 })).toBeNull()
    })

    it('finds the stack whose compact button contains the point', () => {
        const stackA = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]
        const stackB = [makeCard(1000, 1000, 100, 100, 'c'), makeCard(1010, 1010, 100, 100, 'd')]
        const box = computeCompactButtonBox(stackA)!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        expect(findStackByCompactButtonAtPoint([stackA, stackB], point)).toBe(stackA)
    })

    it('never matches a single-card stack, even near where its handle would be', () => {
        const single = [makeCard(0, 0, 100, 100, 'a')]
        const stackB = [makeCard(1000, 1000, 100, 100, 'c'), makeCard(1010, 1010, 100, 100, 'd')]
        const box = computeCompactButtonBox(stackB)!
        const point = { x: box.x + 1, y: box.y + 1 }

        expect(findStackByCompactButtonAtPoint([single, stackB], point)).toBe(stackB)
    })
})

describe('computeNameButtonBox', () => {
    it('sits symmetrically opposite the compact button, on the other side of the handle', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]

        const pad = STACK_HIGHLIGHT_PADDING
        const bx = -pad
        const by = -pad
        const bw = 110 + pad * 2
        const handleWidth = Math.min(bw, 80)
        const hx = bx + (bw - handleWidth) / 2
        const hy = by - STACK_HANDLE_HEIGHT / 2

        expect(computeNameButtonBox(stack)).toEqual({
            x: hx - STACK_NAME_BUTTON_GAP - STACK_NAME_BUTTON_SIZE,
            y: hy + (STACK_HANDLE_HEIGHT - STACK_NAME_BUTTON_SIZE) / 2,
            width: STACK_NAME_BUTTON_SIZE,
            height: STACK_NAME_BUTTON_SIZE,
        })
    })

    it('is also defined for a single-card stack, unlike the compact button', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a')]

        expect(computeNameButtonBox(stack)).not.toBeNull()
    })
})

describe('findStackByNameButtonAtPoint', () => {
    it('finds the stack whose name button contains the point, including a single-card stack', () => {
        const single = [makeCard(0, 0, 100, 100, 'a')]
        const box = computeNameButtonBox(single)
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        expect(findStackByNameButtonAtPoint([single], point)).toBe(single)
    })

    it('returns null when the point is outside every name button', () => {
        const single = [makeCard(0, 0, 100, 100, 'a')]

        expect(findStackByNameButtonAtPoint([single], { x: -9999, y: -9999 })).toBeNull()
    })
})
