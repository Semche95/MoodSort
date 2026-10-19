import { ViewportSize } from './viewport-size.types'

export const HISTORY_KEY = 'moodsort-history' as const

/** An untouched card of the same pile, with the offset to it in card-scale units, so a restore lands back on that pile whatever the canvas size. */
export interface HistoryAnchor {
    id: string
    dx: number
    dy: number
}

/** A position/z-index snapshot of one identifiable entity, framework-agnostic. */
export interface HistorySnapshot {
    id: string
    x: number
    y: number
    index: number
    anchor?: HistoryAnchor
}

export interface CardActionEntry {
    cards: Record<string, {
        fromX: number
        fromY: number
        fromIndex: number
        toX: number
        toY: number
        toIndex: number
        fromAnchor?: HistoryAnchor
        toAnchor?: HistoryAnchor
    }>
    /** Canvas size the action was recorded under; absent from entries saved before it was tracked. */
    viewport?: ViewportSize
    /**
     * Stack name changes, keyed by the imageUrl of the card whose name slot
     * changed. Can be bundled into the same undo step as the card moves
     * above, though in practice a rename via the name button carries no
     * position changes of its own (empty `cards`). A `null` side means "no
     * name" (either newly named, or cleared).
     */
    stackNameChanges?: Record<string, { from: string | null; to: string | null }>
}

export interface HistoryData {
    undoStack: CardActionEntry[]
    redoStack: CardActionEntry[]
}
