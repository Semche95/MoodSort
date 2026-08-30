import { CardActionEntry, HistoryData, HistorySnapshot, HISTORY_KEY } from '../../types/history.types'
import { IStore } from '../../types/store.types'

const MAX_HISTORY = 15

/** Has no knowledge of how entities are rendered: callers hand it plain snapshots and get plain entries back to apply themselves. */
export class ActionHistory {
    private store: IStore
    private undoStack: CardActionEntry[]
    private redoStack: CardActionEntry[]
    private beforeSnapshot: Map<string, HistorySnapshot> | null
    private onUpdate: () => void

    constructor(store: IStore, onUpdate: () => void) {
        this.store = store
        this.onUpdate = onUpdate
        this.beforeSnapshot = null
        const saved = this.store.load<HistoryData>(HISTORY_KEY)
        this.undoStack = saved?.undoStack ?? []
        this.redoStack = saved?.redoStack ?? []
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0
    }

    captureBefore(snapshots: HistorySnapshot[]): void {
        this.beforeSnapshot = new Map(snapshots.map((s: HistorySnapshot): [string, HistorySnapshot] => [s.id, s]))
    }

    recordAfter(snapshots: HistorySnapshot[]): void {
        if (!this.beforeSnapshot) {
            return
        }
        const entry: CardActionEntry = { cards: {} }
        let changed = false

        for (const after of snapshots) {
            const before = this.beforeSnapshot.get(after.id)
            if (!before) {
                continue
            }

            if (before.x !== after.x || before.y !== after.y || before.index !== after.index) {
                changed = true
            }

            entry.cards[after.id] = {
                fromX: before.x,
                fromY: before.y,
                fromIndex: before.index,
                toX: after.x,
                toY: after.y,
                toIndex: after.index,
            }
        }

        this.beforeSnapshot = null

        if (!changed) {
            return
        }

        this.undoStack.push(entry)
        if (this.undoStack.length > MAX_HISTORY) {
            this.undoStack.shift()
        }
        this.redoStack = []
        this.persist()
        this.onUpdate()
    }

    undo(): CardActionEntry | undefined {
        const entry = this.undoStack.pop()
        if (!entry) {
            return undefined
        }
        this.redoStack.push(entry)
        this.persist()
        this.onUpdate()
        return entry
    }

    redo(): CardActionEntry | undefined {
        const entry = this.redoStack.pop()
        if (!entry) {
            return undefined
        }
        this.undoStack.push(entry)
        this.persist()
        this.onUpdate()
        return entry
    }

    clear(): void {
        this.undoStack = []
        this.redoStack = []
        this.beforeSnapshot = null
        this.persist()
        this.onUpdate()
    }

    private persist(): void {
        this.store.save<HistoryData>(HISTORY_KEY, {
            undoStack: this.undoStack,
            redoStack: this.redoStack,
        })
    }
}
