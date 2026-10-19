import { Box } from '../../../types/box.types'
import { Position } from '../../../types/position.types'
import { ViewportSize } from '../../../types/viewport-size.types'
import { StackSpreadLayout } from '../../../types/stack-spread-layout.types'
import { StackSpreadScrollbar } from '../../../types/stack-spread-scrollbar.types'
import { StackSpreadPillLayout } from '../../../types/stack-spread-pill-layout.types'
import { isPointInBox } from '../stack-hit-testing'
import { STACK_PILL_HEIGHT, STACK_PILL_ICON_WIDTH, STACK_PILL_NAME_PADDING, STACK_PILL_PADDING } from '../stack'
import { TOOLBAR_BOTTOM } from '../../toolbar/toolbar-view'

/** Narrowest a spread card gets: below it, the label baked at the bottom of the card turns unreadable. */
export const SPREAD_MIN_CARD_WIDTH: number = 141
export const SPREAD_GAP: number = 12
export const SPREAD_MARGIN: number = 16
const TOOLBAR_CLEARANCE = 8
/** Highest the pill goes: just under the toolbar row, which stays drawn above the spread */
export const SPREAD_PILL_TOP: number = TOOLBAR_BOTTOM + TOOLBAR_CLEARANCE
export const SPREAD_PILL_GAP: number = 8
/** Top of the card area, leaving room for the pill above the first row */
export const SPREAD_TOP: number = SPREAD_PILL_TOP + STACK_PILL_HEIGHT + SPREAD_PILL_GAP
const SCROLLBAR_WIDTH = 4
const SCROLLBAR_INSET = 8
const SCROLLBAR_HIT_WIDTH = 16
const PILL_LABEL_GAP = 8

function fitColumns(cardWidth: number, viewport: ViewportSize): number {
    return Math.max(1, Math.floor((viewport.width - SPREAD_MARGIN * 2 + SPREAD_GAP) / (cardWidth + SPREAD_GAP)))
}

function fitRows(cardHeight: number, viewport: ViewportSize): number {
    return Math.max(1, Math.floor((viewport.height - SPREAD_TOP - SPREAD_MARGIN + SPREAD_GAP) / (cardHeight + SPREAD_GAP)))
}

/**
 * Lays `count` cards out at the largest width that shows them all at once, never above the board's own card size
 * (or the readable minimum, when board cards are smaller) and never under the readable minimum: past that, rows
 * scroll. Columns are then balanced so the last row isn't left almost empty.
 */
export function computeStackSpreadLayout(count: number, viewport: ViewportSize, boardCardWidth: number, cardRatio: number): StackSpreadLayout {
    let cardWidth = SPREAD_MIN_CARD_WIDTH
    for (let width = Math.max(boardCardWidth, SPREAD_MIN_CARD_WIDTH); width >= SPREAD_MIN_CARD_WIDTH; width--) {
        if (fitColumns(width, viewport) * fitRows(width * cardRatio, viewport) >= count) {
            cardWidth = width
            break
        }
    }
    const cardHeight = cardWidth * cardRatio
    const fitColumnCount = fitColumns(cardWidth, viewport)
    const fitRowCount = fitRows(cardHeight, viewport)
    const neededRows = Math.ceil(count / Math.min(fitColumnCount, count))
    const columns = neededRows <= fitRowCount ? Math.ceil(count / neededRows) : fitColumnCount
    const totalRows = Math.ceil(count / columns)
    const visibleRows = Math.min(fitRowCount, totalRows)
    const gridWidth = columns * cardWidth + (columns - 1) * SPREAD_GAP
    const gridHeight = visibleRows * cardHeight + (visibleRows - 1) * SPREAD_GAP
    return {
        cardWidth,
        cardHeight,
        columns,
        visibleRows,
        totalRows,
        originX: (viewport.width - gridWidth) / 2,
        originY: SPREAD_TOP + (viewport.height - SPREAD_TOP - SPREAD_MARGIN - gridHeight) / 2,
    }
}

/** First visible row within the scrollable range. */
export function clampSpreadRow(layout: StackSpreadLayout, row: number): number {
    return Math.max(0, Math.min(row, layout.totalRows - layout.visibleRows))
}

/** Cell of the `slot`-th visible card, counted row by row from the top-left one. */
export function computeSpreadCellBox(layout: StackSpreadLayout, slot: number): Box {
    return {
        x: layout.originX + (slot % layout.columns) * (layout.cardWidth + SPREAD_GAP),
        y: layout.originY + Math.floor(slot / layout.columns) * (layout.cardHeight + SPREAD_GAP),
        width: layout.cardWidth,
        height: layout.cardHeight,
    }
}

/** Visible slot whose cell holds `point`, or null in the gaps and margins; slots past `count` hold no card. */
export function findSpreadSlotAt(layout: StackSpreadLayout, point: Position, count: number): number | null {
    const column = Math.floor((point.x - layout.originX) / (layout.cardWidth + SPREAD_GAP))
    const row = Math.floor((point.y - layout.originY) / (layout.cardHeight + SPREAD_GAP))
    if (column < 0 || column >= layout.columns || row < 0 || row >= layout.visibleRows) {
        return null
    }
    const slot = row * layout.columns + column
    return slot < count && isPointInBox(point, computeSpreadCellBox(layout, slot)) ? slot : null
}

/** Thin bar along the right edge of the card area, or null when every row already shows. */
export function computeSpreadScrollbar(layout: StackSpreadLayout, row: number, viewport: ViewportSize): StackSpreadScrollbar | null {
    if (layout.visibleRows >= layout.totalRows) {
        return null
    }
    const height = viewport.height - SPREAD_TOP - SPREAD_MARGIN
    const x = viewport.width - SCROLLBAR_INSET - SCROLLBAR_WIDTH / 2
    return {
        track: { x, y: SPREAD_TOP, width: SCROLLBAR_WIDTH, height },
        thumb: {
            x,
            y: SPREAD_TOP + (height * row) / layout.totalRows,
            width: SCROLLBAR_WIDTH,
            height: (height * layout.visibleRows) / layout.totalRows,
        },
        hitArea: { x: viewport.width - SCROLLBAR_HIT_WIDTH, y: SPREAD_TOP, width: SCROLLBAR_HIT_WIDTH, height },
    }
}

/** Row that centers the scrollbar thumb on a pointer at `y`, the way a press or drag on the bar scrolls. */
export function computeSpreadRowAtScrollbarY(layout: StackSpreadLayout, y: number, viewport: ViewportSize): number {
    const height = viewport.height - SPREAD_TOP - SPREAD_MARGIN
    return clampSpreadRow(layout, Math.round(((y - SPREAD_TOP) / height) * layout.totalRows - layout.visibleRows / 2))
}

/** Centered pill just above the first card row, around a label already measured (and truncated) to `labelWidth`, with the close button on its right end. */
export function computeSpreadPillLayout(labelWidth: number, layout: StackSpreadLayout, viewport: ViewportSize): StackSpreadPillLayout {
    const width = STACK_PILL_PADDING + STACK_PILL_NAME_PADDING * 2 + labelWidth + PILL_LABEL_GAP + STACK_PILL_ICON_WIDTH + STACK_PILL_PADDING
    const pill = { x: (viewport.width - width) / 2, y: layout.originY - SPREAD_PILL_GAP - STACK_PILL_HEIGHT, width, height: STACK_PILL_HEIGHT }
    return {
        pill,
        label: { x: pill.x + STACK_PILL_PADDING + STACK_PILL_NAME_PADDING * 2, y: pill.y + STACK_PILL_HEIGHT / 2 },
        close: { x: pill.x + width - STACK_PILL_PADDING - STACK_PILL_ICON_WIDTH, y: pill.y, width: STACK_PILL_ICON_WIDTH, height: STACK_PILL_HEIGHT },
    }
}
