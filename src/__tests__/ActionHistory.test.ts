import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionHistory } from '../services/ActionHistory'
import { InMemoryStore } from './InMemoryStore'
import { HistorySnapshot, HistoryData, HISTORY_KEY } from '../types/history.types'

function snap(id: string, x: number, y: number, index: number): HistorySnapshot {
    return { id, x, y, index }
}

describe('ActionHistory', () => {
    let store: InMemoryStore
    let onUpdate: () => void
    let history: ActionHistory

    beforeEach(() => {
        store = new InMemoryStore()
        onUpdate = vi.fn()
        history = new ActionHistory(store, onUpdate)
    })

    it('starts with empty undo/redo stacks', () => {
        expect(history.canUndo).toBe(false)
        expect(history.canRedo).toBe(false)
    })

    it('restores undo/redo stacks previously persisted in the store', () => {
        const priorEntry = { cards: { a: { fromX: 0, fromY: 0, fromIndex: 0, toX: 1, toY: 1, toIndex: 0 } } }
        store.save<HistoryData>(HISTORY_KEY, { undoStack: [priorEntry], redoStack: [priorEntry] })

        const restored = new ActionHistory(store, onUpdate)

        expect(restored.canUndo).toBe(true)
        expect(restored.canRedo).toBe(true)
    })

    it('records nothing when recordAfter is called without a prior captureBefore', () => {
        history.recordAfter([snap('a', 10, 10, 0)])

        expect(history.canUndo).toBe(false)
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('records nothing when the snapshots are unchanged', () => {
        history.captureBefore([snap('a', 10, 10, 0)])
        history.recordAfter([snap('a', 10, 10, 0)])

        expect(history.canUndo).toBe(false)
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('pushes an undo entry when a snapshot moved', () => {
        history.captureBefore([snap('a', 10, 10, 0)])
        history.recordAfter([snap('a', 50, 60, 1)])

        expect(history.canUndo).toBe(true)
        expect(onUpdate).toHaveBeenCalledTimes(1)
        expect(store.load<HistoryData>(HISTORY_KEY)?.undoStack).toEqual([
            { cards: { a: { fromX: 10, fromY: 10, fromIndex: 0, toX: 50, toY: 60, toIndex: 1 } } },
        ])
    })

    it('pushes an undo entry when only the z-index changed', () => {
        history.captureBefore([snap('a', 10, 10, 0)])
        history.recordAfter([snap('a', 10, 10, 2)])

        expect(history.canUndo).toBe(true)
    })

    it('ignores a snapshot present only in the after set', () => {
        history.captureBefore([snap('a', 10, 10, 0)])
        history.recordAfter([snap('a', 10, 10, 0), snap('b', 5, 5, 1)])

        expect(history.canUndo).toBe(false)
    })

    it('clears the redo stack once a new action is recorded', () => {
        history.captureBefore([snap('a', 0, 0, 0)])
        history.recordAfter([snap('a', 1, 1, 0)])
        history.undo()
        expect(history.canRedo).toBe(true)

        history.captureBefore([snap('a', 0, 0, 0)])
        history.recordAfter([snap('a', 2, 2, 0)])

        expect(history.canRedo).toBe(false)
    })

    it('caps the undo stack at 15 entries, dropping the oldest', () => {
        for (let i = 0; i < 16; i++) {
            history.captureBefore([snap('a', i, i, 0)])
            history.recordAfter([snap('a', i + 1, i + 1, 0)])
        }

        const undoStack = store.load<HistoryData>(HISTORY_KEY)?.undoStack
        expect(undoStack).toHaveLength(15)
        expect(undoStack?.[0].cards.a.fromX).toBe(1)
    })

    it('undo returns the last entry and moves it to the redo stack', () => {
        history.captureBefore([snap('a', 0, 0, 0)])
        history.recordAfter([snap('a', 5, 5, 0)])

        const entry = history.undo()

        expect(entry).toEqual({ cards: { a: { fromX: 0, fromY: 0, fromIndex: 0, toX: 5, toY: 5, toIndex: 0 } } })
        expect(history.canUndo).toBe(false)
        expect(history.canRedo).toBe(true)
    })

    it('undo on an empty stack returns undefined and does not call onUpdate', () => {
        const entry = history.undo()

        expect(entry).toBeUndefined()
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('redo returns the entry back and moves it to the undo stack', () => {
        history.captureBefore([snap('a', 0, 0, 0)])
        history.recordAfter([snap('a', 5, 5, 0)])
        history.undo()

        const entry = history.redo()

        expect(entry).toEqual({ cards: { a: { fromX: 0, fromY: 0, fromIndex: 0, toX: 5, toY: 5, toIndex: 0 } } })
        expect(history.canUndo).toBe(true)
        expect(history.canRedo).toBe(false)
    })

    it('redo on an empty stack returns undefined and does not call onUpdate', () => {
        const entry = history.redo()

        expect(entry).toBeUndefined()
        expect(onUpdate).not.toHaveBeenCalled()
    })

    it('clear resets both stacks and persists the empty state', () => {
        history.captureBefore([snap('a', 0, 0, 0)])
        history.recordAfter([snap('a', 5, 5, 0)])
        history.undo()

        history.clear()

        expect(history.canUndo).toBe(false)
        expect(history.canRedo).toBe(false)
        expect(store.load<HistoryData>(HISTORY_KEY)).toEqual({ undoStack: [], redoStack: [] })
    })
})
