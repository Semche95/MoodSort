import { describe, it, expect } from 'vitest'
import { computeStacks, findStack, findStackAtPoint, listLayerCards, STACK_FRAME_CLEARANCE, STACK_HIGHLIGHT_PADDING } from '../features/stack/stack'
import type { Container } from 'pixi.js'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

/** Counts reads of `width`, which on a real card makes Pixi recompute its bounds. */
function makeCountedCard(x: number, y: number, imageUrl: string, reads: { count: number }): Card {
    return {
        x,
        y,
        height: 100,
        imageUrl,
        get width(): number {
            reads.count++
            return 100
        },
    } as unknown as Card
}

describe('computeStacks', () => {
    it('groups cards linked by a chain of overlaps and leaves apart cards alone', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(80, 0, 100, 100, 'b')
        const c = makeCard(160, 0, 100, 100, 'c')
        const d = makeCard(500, 0, 100, 100, 'd')
        expect(computeStacks([a, b, c, d])).toEqual([[a, b, c], [d]])
    })

    it('reads each card size once, however many pairs it is tested against', () => {
        const reads = { count: 0 }
        const cards = Array.from({ length: 20 }, (_: unknown, i: number): Card => makeCountedCard(i * 10, 0, String(i), reads))
        computeStacks(cards)
        expect(reads.count).toBe(cards.length)
    })
})

describe('findStack', () => {
    it('returns the cards linked to the given one by a chain of overlaps', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(80, 0, 100, 100, 'b')
        const c = makeCard(160, 0, 100, 100, 'c')
        const d = makeCard(500, 0, 100, 100, 'd')
        expect(findStack(c, [a, b, c, d])).toEqual([c, b, a])
    })

    it('also groups a card missing from the given list', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(80, 0, 100, 100, 'b')
        expect(findStack(a, [b])).toEqual([a, b])
    })

    it('reads each card size once, however many pairs it is tested against', () => {
        const reads = { count: 0 }
        const cards = Array.from({ length: 20 }, (_: unknown, i: number): Card => makeCountedCard(i * 10, 0, String(i), reads))
        findStack(cards[0], cards)
        expect(reads.count).toBe(cards.length + 1)
    })
})

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

describe('listLayerCards', () => {
    it('keeps only the cards of the layer, in z-order', () => {
        const a = { imageUrl: 'a' }
        const b = { imageUrl: 'b' }
        const layer = { children: [{ label: 'frame' }, a, { label: 'pill' }, b] } as unknown as Container

        expect(listLayerCards(layer)).toEqual([a, b])
    })
})
