import { Container } from 'pixi.js'
import { Card, CardActionEntry, HistoryData, HISTORY_KEY } from '../types/card.types'
import { IStore } from './Store'

const MAX_HISTORY: number = 15

/**
 * Manages undo/redo history for card actions.
 * Captures before/after snapshots and persists to localStorage.
 */
export class ActionHistory {
    private store: IStore
    private undoStack: CardActionEntry[]
    private redoStack: CardActionEntry[]
    private beforeSnapshot: Map<Card, { x: number; y: number; index: number }> | null
    private onUpdate: () => void

    constructor(store: IStore, onUpdate: () => void) {
        this.store = store
        this.onUpdate = onUpdate
        this.beforeSnapshot = null
        const saved: HistoryData | null = this.store.load<HistoryData>(HISTORY_KEY)
        this.undoStack = saved?.undoStack ?? []
        this.redoStack = saved?.redoStack ?? []
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0
    }

    captureBefore(cards: Card[], stage: Container): void {
        this.beforeSnapshot = new Map()
        for (const card of cards) {
            this.beforeSnapshot.set(card, {
                x: card.x,
                y: card.y,
                index: stage.children.indexOf(card),
            })
        }
    }

    recordAfter(cards: Card[], stage: Container): void {
        if (!this.beforeSnapshot) {
            return
        }
        const entry: CardActionEntry = { cards: {} }
        let changed: boolean = false

        for (const card of cards) {
            const before = this.beforeSnapshot.get(card)
            if (!before) {
                continue
            }
            const toIndex: number = stage.children.indexOf(card)
            const toX: number = card.x
            const toY: number = card.y

            if (before.x !== toX || before.y !== toY || before.index !== toIndex) {
                changed = true
            }

            entry.cards[card.imageUrl] = {
                fromX: before.x,
                fromY: before.y,
                fromIndex: before.index,
                toX,
                toY,
                toIndex,
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

    undo(allCards: Card[], stage: Container): void {
        const entry: CardActionEntry | undefined = this.undoStack.pop()
        if (!entry) {
            return
        }
        this.applyEntry(entry, allCards, stage, true)
        this.redoStack.push(entry)
        this.persist()
        this.onUpdate()
    }

    redo(allCards: Card[], stage: Container): void {
        const entry: CardActionEntry | undefined = this.redoStack.pop()
        if (!entry) {
            return
        }
        this.applyEntry(entry, allCards, stage, false)
        this.undoStack.push(entry)
        this.persist()
        this.onUpdate()
    }

    clear(): void {
        this.undoStack = []
        this.redoStack = []
        this.beforeSnapshot = null
        this.persist()
        this.onUpdate()
    }

    private applyEntry(
        entry: CardActionEntry,
        allCards: Card[],
        stage: Container,
        reverse: boolean,
    ): void {
        const affected: Array<{ card: Card; index: number }> = []

        for (const [imageUrl, data] of Object.entries(entry.cards)) {
            const card: Card | undefined = allCards.find(
                (c: Card): boolean => c.imageUrl === imageUrl,
            )
            if (!card) {
                continue
            }
            const index: number = reverse ? data.fromIndex : data.toIndex
            const x: number = reverse ? data.fromX : data.toX
            const y: number = reverse ? data.fromY : data.toY

            card.x = x
            card.y = y
            affected.push({ card, index })
        }

        restoreCardZIndices(stage, affected)
    }

    private persist(): void {
        this.store.save<HistoryData>(HISTORY_KEY, {
            undoStack: this.undoStack,
            redoStack: this.redoStack,
        })
    }
}

function restoreCardZIndices(
    stage: Container,
    entries: Array<{ card: Card; index: number }>,
): void {
    entries.sort((a: { card: Card; index: number }, b: { card: Card; index: number }): number => a.index - b.index)

    for (const { card } of entries) {
        if (card.parent === stage) {
            stage.removeChild(card)
        }
    }

    for (const { card, index } of entries) {
        const insertAt: number = Math.min(index, stage.children.length)
        stage.addChildAt(card, insertAt)
    }
}
