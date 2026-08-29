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
}

export interface HistoryData {
    undoStack: CardActionEntry[]
    redoStack: CardActionEntry[]
}
