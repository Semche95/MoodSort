import { describe, it, expect } from 'vitest'
import type { Container } from 'pixi.js'
import {
    getStackAnchor,
    computeStackLabel,
    computeNameButtonBox,
    findStackByNameButtonAtPoint,
    computeLabelAnchorPoint,
    resolveNameSplits,
    resolveNameMerges,
    STACK_NAME_BUTTON_SIZE,
    STACK_NAME_BUTTON_GAP,
    STACK_HANDLE_HEIGHT,
    STACK_HIGHLIGHT_PADDING,
    STACK_LABEL_HANDLE_GAP,
} from '../features/stack/stack'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height } as unknown as Card
}

/** A minimal stand-in for the card layer: z-order is just the array index, exactly like Pixi's children order. */
function makeCardLayer(cards: Card[]): Container {
    return { children: cards } as unknown as Container
}

describe('getStackAnchor', () => {
    it('returns the card with the lowest z-order (index) in the layer', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const cardLayer = makeCardLayer([c, a, b])

        expect(getStackAnchor([a, b, c], cardLayer)).toBe(c)
    })

    it('returns the only card of a single-card stack', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const cardLayer = makeCardLayer([a])

        expect(getStackAnchor([a], cardLayer)).toBe(a)
    })
})

describe('computeStackLabel', () => {
    it('returns an empty string for a stack with no named anchor', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const cardLayer = makeCardLayer([a])

        expect(computeStackLabel([a], cardLayer, {})).toBe('')
    })

    it('returns the anchor name for a single named card', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const cardLayer = makeCardLayer([a])

        expect(computeStackLabel([a], cardLayer, { a: 'Joie' })).toBe('Joie')
    })

    it('ignores unnamed cards mixed into a named stack', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const cardLayer = makeCardLayer([a, b])

        expect(computeStackLabel([a, b], cardLayer, { a: 'Joie' })).toBe('Joie')
    })

    it('concatenates two anchor names in z-order when a cluster has two named anchors', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        // z-order (layer index) has b before a, so the label must follow that order, not array order.
        const cardLayer = makeCardLayer([b, a])

        expect(computeStackLabel([a, b], cardLayer, { a: 'Joie', b: 'Colère' })).toBe('Colère + Joie')
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

describe('computeLabelAnchorPoint', () => {
    it('sits just below the handle\'s bottom edge, clear of its clickable area', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]

        const pad = STACK_HIGHLIGHT_PADDING

        expect(computeLabelAnchorPoint(stack)).toEqual({
            x: 55,
            y: -pad + STACK_HANDLE_HEIGHT / 2 + STACK_LABEL_HANDLE_GAP,
        })
    })
})

describe('resolveNameSplits', () => {
    it('moves the name to the larger resulting group, not wherever the literal named card ends up', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const cardLayer = makeCardLayer([b, c, a])
        const stackNames: Record<string, string> = { a: 'Joie' }

        const result = resolveNameSplits([[a, b, c]], [[a], [b, c]], cardLayer, stackNames)

        expect(stackNames).toEqual({ b: 'Joie' })
        expect(result).toEqual({
            before: { a: 'Joie', b: null },
            after: { a: null, b: 'Joie' },
        })
    })

    it('never lets a group reduced to one card inherit the name while another resulting group still has 2 or more cards', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const d = makeCard(0, 0, 100, 100, 'd')
        // d has the lowest z-order of everyone, but it's solo: it must still lose to {b, c}.
        const cardLayer = makeCardLayer([d, b, c, a])
        const stackNames: Record<string, string> = { a: 'Joie' }

        resolveNameSplits([[a, b, c, d]], [[a], [b, c], [d]], cardLayer, stackNames)

        expect(stackNames).toEqual({ b: 'Joie' })
    })

    it('breaks a tie between two groups both of size 2+ by z-order, per the existing anchor rule', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const d = makeCard(0, 0, 100, 100, 'd')
        const e = makeCard(0, 0, 100, 100, 'e')
        // {d, e} has the lower z-order anchor (d), so it wins the size tie over {b, c}.
        const cardLayer = makeCardLayer([d, e, b, c, a])
        const stackNames: Record<string, string> = { a: 'Joie' }

        resolveNameSplits([[a, b, c, d, e]], [[a], [b, c], [d, e]], cardLayer, stackNames)

        expect(stackNames).toEqual({ d: 'Joie' })
    })

    it('falls back to z-order when every resulting group is a singleton', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const cardLayer = makeCardLayer([b, a])
        const stackNames: Record<string, string> = { a: 'Joie' }

        resolveNameSplits([[a, b]], [[a], [b]], cardLayer, stackNames)

        expect(stackNames).toEqual({ b: 'Joie' })
    })

    it('does nothing when the named card already sits in the winning group', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const cardLayer = makeCardLayer([a, b, c])
        const stackNames: Record<string, string> = { a: 'Joie' }

        const result = resolveNameSplits([[a, b, c]], [[a, b], [c]], cardLayer, stackNames)

        expect(stackNames).toEqual({ a: 'Joie' })
        expect(result).toEqual({ before: {}, after: {} })
    })

    it('does nothing when the stack has not actually split', () => {
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const cardLayer = makeCardLayer([a, b])
        const stackNames: Record<string, string> = { a: 'Joie' }

        resolveNameSplits([[a, b]], [[a, b]], cardLayer, stackNames)

        expect(stackNames).toEqual({ a: 'Joie' })
    })

    it('leaves a stack with two named cards alone: each name belongs to its own card, no group-size heuristic needed', () => {
        const x = makeCard(0, 0, 100, 100, 'x')
        const y = makeCard(0, 0, 100, 100, 'y')
        const cardLayer = makeCardLayer([y, x])
        const stackNames: Record<string, string> = { x: 'Joie', y: 'Colère' }

        resolveNameSplits([[x, y]], [[x], [y]], cardLayer, stackNames)

        expect(stackNames).toEqual({ x: 'Joie', y: 'Colère' })
    })

    it('never overwrites an existing name on the winning group\'s anchor: lands the reassigned name on an unnamed member instead', () => {
        // a's stack [a, b, c] loses c, which lands on the already-named d, forming [c, d].
        // [a, b] and [c, d] tie in size, and d has the lower z-order, so [c, d] wins - but
        // its anchor (d) is already named 'Colère': the reassigned 'Joie' must not clobber it.
        const a = makeCard(0, 0, 100, 100, 'a')
        const b = makeCard(0, 0, 100, 100, 'b')
        const c = makeCard(0, 0, 100, 100, 'c')
        const d = makeCard(0, 0, 100, 100, 'd')
        const cardLayer = makeCardLayer([d, a, b, c])
        const stackNames: Record<string, string> = { a: 'Joie', d: 'Colère' }

        resolveNameSplits([[a, b, c], [d]], [[a, b], [c, d]], cardLayer, stackNames)

        expect(stackNames).toEqual({ d: 'Colère', c: 'Joie' })
    })
})

describe('resolveNameMerges', () => {
    it('fuses two named cards into a single " + "-joined entry on the lowest z-order one', () => {
        const x = makeCard(0, 0, 100, 100, 'x')
        const y = makeCard(0, 0, 100, 100, 'y')
        const cardLayer = makeCardLayer([x, y])
        const stackNames: Record<string, string> = { x: 'Joie', y: 'Colère' }

        const result = resolveNameMerges([[x, y]], cardLayer, stackNames)

        expect(stackNames).toEqual({ x: 'Joie + Colère' })
        expect(result).toEqual({
            before: { x: 'Joie', y: 'Colère' },
            after: { x: 'Joie + Colère', y: null },
        })
    })

    it('does nothing to a stack with zero or one named card', () => {
        const x = makeCard(0, 0, 100, 100, 'x')
        const y = makeCard(0, 0, 100, 100, 'y')
        const cardLayer = makeCardLayer([x, y])
        const stackNames: Record<string, string> = { x: 'Joie' }

        const result = resolveNameMerges([[x, y]], cardLayer, stackNames)

        expect(stackNames).toEqual({ x: 'Joie' })
        expect(result).toEqual({ before: {}, after: {} })
    })
})
