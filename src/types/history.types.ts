export const HISTORY_KEY = 'moodsort-history' as const

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
