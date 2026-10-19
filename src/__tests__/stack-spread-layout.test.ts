import { describe, expect, it } from 'vitest'
import {
    clampSpreadRow,
    computeSpreadCellBox,
    computeSpreadPillLayout,
    computeSpreadRowAtScrollbarY,
    computeSpreadScrollbar,
    computeStackSpreadLayout,
    findSpreadSlotAt,
    SPREAD_GAP,
    SPREAD_MARGIN,
    SPREAD_MIN_CARD_WIDTH,
    SPREAD_PILL_GAP,
    SPREAD_PILL_TOP,
    SPREAD_TOP,
} from '../features/stack/stack-spread/stack-spread-layout'
import { STACK_PILL_HEIGHT, STACK_PILL_ICON_WIDTH, STACK_PILL_PADDING } from '../features/stack/stack'
import { TOOLBAR_BOTTOM } from '../features/toolbar/toolbar-view'

const CARD_RATIO = 382 / 256
const FULL_HD = { width: 1920, height: 1080 }
const MIN_SCREEN = { width: 1024, height: 768 }

describe('computeStackSpreadLayout', () => {
    it('shows a small stack at the board card size on a single centered row', () => {
        const layout = computeStackSpreadLayout(5, FULL_HD, 192, CARD_RATIO)

        expect(layout.cardWidth).toBe(192)
        expect(layout.cardHeight).toBeCloseTo(192 * CARD_RATIO)
        expect(layout.columns).toBe(5)
        expect(layout.visibleRows).toBe(1)
        expect(layout.totalRows).toBe(1)
        expect(layout.originX).toBe((1920 - (5 * 192 + 4 * SPREAD_GAP)) / 2)
    })

    it('shrinks cards down to the readable minimum for the whole deck, then scrolls whole rows', () => {
        const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)

        expect(layout.cardWidth).toBe(SPREAD_MIN_CARD_WIDTH)
        expect(layout.columns).toBe(12)
        expect(layout.visibleRows).toBe(4)
        expect(layout.totalRows).toBe(8)
    })

    it('draws cards larger than the board ones when board cards are under the readable minimum', () => {
        const layout = computeStackSpreadLayout(3, MIN_SCREEN, 102, CARD_RATIO)

        expect(layout.cardWidth).toBe(SPREAD_MIN_CARD_WIDTH)
    })

    it('balances columns so the last row is not left almost empty', () => {
        const layout = computeStackSpreadLayout(13, FULL_HD, 192, CARD_RATIO)

        expect(layout.totalRows).toBe(2)
        expect(layout.columns).toBe(7)
    })

    it('keeps the grid between the card area top and the bottom margin', () => {
        const layout = computeStackSpreadLayout(85, MIN_SCREEN, 102, CARD_RATIO)
        const bottom = layout.originY + layout.visibleRows * layout.cardHeight + (layout.visibleRows - 1) * SPREAD_GAP

        expect(layout.originY).toBeGreaterThanOrEqual(SPREAD_TOP)
        expect(bottom).toBeLessThanOrEqual(MIN_SCREEN.height - SPREAD_MARGIN)
    })
})

describe('clampSpreadRow', () => {
    const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)

    it('keeps the first visible row within the scrollable range', () => {
        expect(clampSpreadRow(layout, -1)).toBe(0)
        expect(clampSpreadRow(layout, 2)).toBe(2)
        expect(clampSpreadRow(layout, 99)).toBe(layout.totalRows - layout.visibleRows)
    })
})

describe('computeSpreadCellBox', () => {
    it('places visible slots row by row from the grid origin', () => {
        const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)

        expect(computeSpreadCellBox(layout, layout.columns + 1)).toEqual({
            x: layout.originX + layout.cardWidth + SPREAD_GAP,
            y: layout.originY + layout.cardHeight + SPREAD_GAP,
            width: layout.cardWidth,
            height: layout.cardHeight,
        })
    })
})

describe('findSpreadSlotAt', () => {
    const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)

    it('finds the slot whose cell holds the point', () => {
        const cell = computeSpreadCellBox(layout, 13)

        expect(findSpreadSlotAt(layout, { x: cell.x + 5, y: cell.y + 5 }, 48)).toBe(13)
    })

    it('returns null in a gap, outside the grid, or on a slot past the last card', () => {
        const cell = computeSpreadCellBox(layout, 0)
        const lastSlot = computeSpreadCellBox(layout, 47)

        expect(findSpreadSlotAt(layout, { x: cell.x + cell.width + SPREAD_GAP / 2, y: cell.y + 5 }, 48)).toBeNull()
        expect(findSpreadSlotAt(layout, { x: 2, y: 2 }, 48)).toBeNull()
        expect(findSpreadSlotAt(layout, { x: lastSlot.x + 5, y: lastSlot.y + 5 }, 47)).toBeNull()
    })
})

describe('computeSpreadScrollbar', () => {
    it('is null when every row already shows', () => {
        expect(computeSpreadScrollbar(computeStackSpreadLayout(5, FULL_HD, 192, CARD_RATIO), 0, FULL_HD)).toBeNull()
    })

    it('sizes and offsets the thumb after the visible share of rows', () => {
        const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)
        const scrollbar = computeSpreadScrollbar(layout, 4, FULL_HD)!
        const trackHeight = FULL_HD.height - SPREAD_TOP - SPREAD_MARGIN

        expect(scrollbar.track.y).toBe(SPREAD_TOP)
        expect(scrollbar.track.height).toBe(trackHeight)
        expect(scrollbar.thumb.height).toBe(trackHeight / 2)
        expect(scrollbar.thumb.y).toBe(SPREAD_TOP + trackHeight / 2)
        expect(scrollbar.hitArea.x + scrollbar.hitArea.width).toBe(FULL_HD.width)
    })
})

describe('computeSpreadRowAtScrollbarY', () => {
    const layout = computeStackSpreadLayout(85, FULL_HD, 192, CARD_RATIO)

    it('centers the thumb on the pointer, clamped to the scrollable range', () => {
        expect(computeSpreadRowAtScrollbarY(layout, SPREAD_TOP, FULL_HD)).toBe(0)
        expect(computeSpreadRowAtScrollbarY(layout, (SPREAD_TOP + FULL_HD.height - SPREAD_MARGIN) / 2, FULL_HD)).toBe(2)
        expect(computeSpreadRowAtScrollbarY(layout, FULL_HD.height, FULL_HD)).toBe(layout.totalRows - layout.visibleRows)
    })
})

describe('computeSpreadPillLayout', () => {
    it('centers the pill just above the first card row, the close button on its right end', () => {
        const spread = computeStackSpreadLayout(5, FULL_HD, 192, CARD_RATIO)
        const layout = computeSpreadPillLayout(100, spread, FULL_HD)
        const pillY = spread.originY - SPREAD_PILL_GAP - STACK_PILL_HEIGHT

        expect(layout.pill.y).toBe(pillY)
        expect(layout.pill.height).toBe(STACK_PILL_HEIGHT)
        expect(layout.pill.x * 2 + layout.pill.width).toBe(FULL_HD.width)
        expect(layout.close).toEqual({
            x: layout.pill.x + layout.pill.width - STACK_PILL_PADDING - STACK_PILL_ICON_WIDTH,
            y: pillY,
            width: STACK_PILL_ICON_WIDTH,
            height: STACK_PILL_HEIGHT,
        })
        expect(layout.label.y).toBe(pillY + STACK_PILL_HEIGHT / 2)
        expect(layout.label.x + 100).toBeLessThan(layout.close.x)
    })

    it('stays under the toolbar row when the rows fill the screen', () => {
        const spread = computeStackSpreadLayout(85, MIN_SCREEN, 192, CARD_RATIO)

        expect(computeSpreadPillLayout(100, spread, MIN_SCREEN).pill.y).toBeGreaterThanOrEqual(SPREAD_PILL_TOP)
        expect(SPREAD_PILL_TOP).toBeGreaterThan(TOOLBAR_BOTTOM)
    })
})
