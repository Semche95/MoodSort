export const HISTORY_KEY = 'moodsort-history' as const

/** A position/z-index snapshot of one identifiable entity, framework-agnostic. */
export interface HistorySnapshot {
    id: string
    x: number
    y: number
    index: number
}

export interface CardActionEntry {
    cards: Record<string, {
        fromX: number
        fromY: number
        fromIndex: number
        toX: number
        toY: number
        toIndex: number
    }>
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
