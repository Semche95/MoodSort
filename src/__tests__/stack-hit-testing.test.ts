import { describe, it, expect } from 'vitest'
import {
    computeStackActionsLayout,
    computeStackFrame,
    computeStackNameMaxWidth,
    computeStackPillLayout,
    computeStackPillMaxWidth,
    findStackActionAtPoint,
    findStackByActionAtPoint,
    isPointInBox,
} from '../features/stack/stack-hit-testing'
import {
    STACK_FRAME_RADIUS,
    STACK_HIGHLIGHT_PADDING,
    STACK_PILL_HEIGHT,
    STACK_PILL_ICON_WIDTH,
    STACK_PILL_GRIP_WIDTH,
    STACK_PILL_NAME_PADDING,
    STACK_PILL_PADDING,
} from '../features/stack/stack'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

const box = { x: 100, y: 100, width: 200, height: 300 }

describe('isPointInBox', () => {
    it('includes points on the edges and excludes points just outside', () => {
        expect(isPointInBox({ x: 100, y: 400 }, box)).toBe(true)
        expect(isPointInBox({ x: 300, y: 100 }, box)).toBe(true)
        expect(isPointInBox({ x: 99, y: 200 }, box)).toBe(false)
        expect(isPointInBox({ x: 200, y: 401 }, box)).toBe(false)
    })
})

describe('computeStackFrame', () => {
    it('pads the cards bounding box by STACK_HIGHLIGHT_PADDING on every side', () => {
        const pad = STACK_HIGHLIGHT_PADDING
        expect(computeStackFrame(box)).toEqual({ x: 100 - pad, y: 100 - pad, width: 200 + pad * 2, height: 300 + pad * 2 })
    })
})

describe('computeStackPillMaxWidth', () => {
    it('is the frame width minus its two rounded corners', () => {
        expect(computeStackPillMaxWidth(box)).toBe(200 + STACK_HIGHLIGHT_PADDING * 2 - STACK_FRAME_RADIUS * 2)
    })
})

describe('computeStackNameMaxWidth', () => {
    it('reserves the grip and rename slots, so the name never shrinks when the pill is hovered', () => {
        const reserved = STACK_PILL_PADDING * 2 + STACK_PILL_GRIP_WIDTH + STACK_PILL_ICON_WIDTH + STACK_PILL_NAME_PADDING * 2
        expect(computeStackNameMaxWidth(box)).toBe(computeStackPillMaxWidth(box) - reserved)
    })

    it('never goes negative on a frame too narrow for any name', () => {
        expect(computeStackNameMaxWidth({ x: 0, y: 0, width: 10, height: 10 })).toBe(0)
    })
})

describe('computeStackPillLayout', () => {
    it('centers an unnamed pill (grip + rename) on the frame top edge', () => {
        const layout = computeStackPillLayout(box, null)
        const width = STACK_PILL_PADDING * 2 + STACK_PILL_GRIP_WIDTH + STACK_PILL_ICON_WIDTH
        const frame = computeStackFrame(box)

        expect(layout.frame).toEqual(frame)
        expect(layout.pill).toEqual({
            x: frame.x + (frame.width - width) / 2,
            y: frame.y - STACK_PILL_HEIGHT / 2,
            width,
            height: STACK_PILL_HEIGHT,
        })
        expect(layout.name).toBeNull()
    })

    it('widens the pill around a name and puts the grip, name and rename slots left to right', () => {
        const layout = computeStackPillLayout(box, 60)
        const { pill, grip, name, pencil } = layout

        expect(pill.width).toBe(STACK_PILL_PADDING * 2 + STACK_PILL_GRIP_WIDTH + STACK_PILL_ICON_WIDTH + 60 + STACK_PILL_NAME_PADDING * 2)
        expect(grip).toMatchObject({ x: pill.x + STACK_PILL_PADDING, width: STACK_PILL_GRIP_WIDTH })
        expect(name).toEqual({ x: grip.x + STACK_PILL_GRIP_WIDTH + STACK_PILL_NAME_PADDING, y: layout.frame.y })
        expect(pencil.x + pencil.width).toBe(pill.x + pill.width - STACK_PILL_PADDING)
        expect(name!.x + 60 + STACK_PILL_NAME_PADDING).toBe(pencil.x)
    })

    it('keeps a name measured at the max width inside the frame straight edge', () => {
        const { pill } = computeStackPillLayout(box, computeStackNameMaxWidth(box))
        const frame = computeStackFrame(box)

        expect(pill.x).toBe(frame.x + STACK_FRAME_RADIUS)
        expect(pill.x + pill.width).toBe(frame.x + frame.width - STACK_FRAME_RADIUS)
    })
})

describe('computeStackActionsLayout', () => {
    it('returns null for a single-card stack', () => {
        expect(computeStackActionsLayout([makeCard(0, 0, 100, 100, 'a')])).toBeNull()
    })

    it('centers a two-button pill on the frame bottom edge, compact on the left and spread on the right', () => {
        const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]
        const frame = computeStackFrame({ x: 0, y: 0, width: 110, height: 110 })
        const slot = STACK_PILL_PADDING + STACK_PILL_ICON_WIDTH
        const pill = {
            x: frame.x + frame.width / 2 - slot,
            y: frame.y + frame.height - STACK_PILL_HEIGHT / 2,
            width: slot * 2,
            height: STACK_PILL_HEIGHT,
        }

        expect(computeStackActionsLayout(stack)).toEqual({
            pill,
            compact: { ...pill, width: slot },
            spread: { ...pill, x: pill.x + slot, width: slot },
        })
    })
})

describe('findStackByActionAtPoint', () => {
    const single = [makeCard(500, 0, 100, 100, 'c')]
    const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]

    it('returns the stack whose given button contains the point, skipping single cards', () => {
        const { spread } = computeStackActionsLayout(stack)!

        expect(findStackByActionAtPoint([single, stack], { x: spread.x + 1, y: spread.y + 1 }, 'spread')).toBe(stack)
    })

    it('returns null on the other button of the same pill', () => {
        const { compact } = computeStackActionsLayout(stack)!

        expect(findStackByActionAtPoint([stack], { x: compact.x + 1, y: compact.y + 1 }, 'spread')).toBeNull()
    })
})

describe('findStackActionAtPoint', () => {
    const stack = [makeCard(0, 0, 100, 100, 'a'), makeCard(10, 10, 100, 100, 'b')]

    it('names the button under the point along with its stack', () => {
        const { compact, spread } = computeStackActionsLayout(stack)!

        expect(findStackActionAtPoint([stack], { x: compact.x + 1, y: compact.y + 1 })).toEqual({ stack, action: 'compact' })
        expect(findStackActionAtPoint([stack], { x: spread.x + 1, y: spread.y + 1 })).toEqual({ stack, action: 'spread' })
    })

    it('returns null away from every bottom pill', () => {
        expect(findStackActionAtPoint([stack], { x: 1000, y: 1000 })).toBeNull()
    })
})
