import { describe, it, expect } from 'vitest'
import { findStackAtPoint, STACK_FRAME_CLEARANCE, STACK_HIGHLIGHT_PADDING } from '../features/stack/stack'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

describe('findStackAtPoint', () => {
    const stack = [makeCard(100, 100, 200, 300, 'a')]

    it('covers the top pill, which straddles the frame top edge', () => {
        expect(findStackAtPoint([stack], { x: 200, y: 100 - STACK_FRAME_CLEARANCE })).toBe(stack)
    })

    it('covers the compact pill, which straddles the frame bottom edge', () => {
        expect(findStackAtPoint([stack], { x: 200, y: 400 + STACK_FRAME_CLEARANCE })).toBe(stack)
    })

    it('stops at the frame sides and just past the pills', () => {
        expect(findStackAtPoint([stack], { x: 100 - STACK_HIGHLIGHT_PADDING - 1, y: 200 })).toBeNull()
        expect(findStackAtPoint([stack], { x: 200, y: 100 - STACK_FRAME_CLEARANCE - 1 })).toBeNull()
        expect(findStackAtPoint([stack], { x: 200, y: 400 + STACK_FRAME_CLEARANCE + 1 })).toBeNull()
    })
})
