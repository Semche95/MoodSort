import { describe, it, expect } from 'vitest'
import type { Container } from 'pixi.js'
import { snapshotCards, applyHistoryEntry, applyStackNameChanges } from '../features/history/history'
import { Card } from '../types/card.types'
import { CardActionEntry } from '../types/history.types'

class FakeStage {
    children: FakeCard[] = []
    removeChild(child: FakeCard): void {
        const index = this.children.indexOf(child)
        if (index !== -1) {
            this.children.splice(index, 1)
            child.parent = null
        }
    }
    addChildAt(child: FakeCard, index: number): void {
        this.children.splice(index, 0, child)
        child.parent = this
    }
}

class FakeCard {
    imageUrl: string
    x: number
    y: number
    parent: FakeStage | null = null
    constructor(imageUrl: string, x: number, y: number) {
        this.imageUrl = imageUrl
        this.x = x
        this.y = y
    }
}

function makeStage(cards: FakeCard[]): FakeStage {
    const stage = new FakeStage()
    for (const card of cards) {
        stage.addChildAt(card, stage.children.length)
    }
    return stage
}

describe('snapshotCards', () => {
    it('reads position and stage z-index into a plain snapshot per card', () => {
        const a = new FakeCard('a', 10, 20)
        const b = new FakeCard('b', 30, 40)
        const stage = makeStage([a, b])

        const snapshots = snapshotCards(
            [a, b] as unknown as Card[],
            stage as unknown as Container,
        )

        expect(snapshots).toEqual([
            { id: 'a', x: 10, y: 20, index: 0 },
            { id: 'b', x: 30, y: 40, index: 1 },
        ])
    })
})

describe('applyHistoryEntry', () => {
    function makeEntry(): CardActionEntry {
        return {
            cards: {
                a: { fromX: 10, fromY: 20, fromIndex: 0, toX: 100, toY: 200, toIndex: 1 },
                b: { fromX: 30, fromY: 40, fromIndex: 1, toX: 300, toY: 400, toIndex: 0 },
            },
        }
    }

    it('applies the "to" side and reorders z-index when reverse is false', () => {
        const a = new FakeCard('a', 10, 20)
        const b = new FakeCard('b', 30, 40)
        const stage = makeStage([a, b])

        applyHistoryEntry(
            makeEntry(),
            [a, b] as unknown as Card[],
            stage as unknown as Container,
            false,
        )

        expect(a.x).toBe(100)
        expect(a.y).toBe(200)
        expect(b.x).toBe(300)
        expect(b.y).toBe(400)
        expect(stage.children).toEqual([b, a])
    })

    it('applies the "from" side and reorders z-index when reverse is true', () => {
        const a = new FakeCard('a', 100, 200)
        const b = new FakeCard('b', 300, 400)
        const stage = makeStage([b, a])

        applyHistoryEntry(
            makeEntry(),
            [a, b] as unknown as Card[],
            stage as unknown as Container,
            true,
        )

        expect(a.x).toBe(10)
        expect(a.y).toBe(20)
        expect(b.x).toBe(30)
        expect(b.y).toBe(40)
        expect(stage.children).toEqual([a, b])
    })

    it('skips entries whose card is no longer in allCards', () => {
        const b = new FakeCard('b', 30, 40)
        const stage = makeStage([b])

        expect(() => applyHistoryEntry(
            makeEntry(),
            [b] as unknown as Card[],
            stage as unknown as Container,
            false,
        )).not.toThrow()

        expect(b.x).toBe(300)
        expect(b.y).toBe(400)
    })
})

describe('applyStackNameChanges', () => {
    it('does nothing when the entry carries no name changes', () => {
        const stackNames = { a: 'Joie' }

        applyStackNameChanges({ cards: {} }, stackNames, false)

        expect(stackNames).toEqual({ a: 'Joie' })
    })

    it('applies the "to" side when reverse is false', () => {
        const stackNames: Record<string, string> = {}
        const entry: CardActionEntry = {
            cards: {},
            stackNameChanges: { anchor: { from: null, to: 'Joie' } },
        }

        applyStackNameChanges(entry, stackNames, false)

        expect(stackNames).toEqual({ anchor: 'Joie' })
    })

    it('applies the "from" side when reverse is true, deleting the key if it was null', () => {
        const stackNames: Record<string, string> = { anchor: 'Joie' }
        const entry: CardActionEntry = {
            cards: {},
            stackNameChanges: { anchor: { from: null, to: 'Joie' } },
        }

        applyStackNameChanges(entry, stackNames, true)

        expect(stackNames).toEqual({})
    })

    it('reassigns a name from one key to another in a single call', () => {
        const stackNames: Record<string, string> = { a: 'Joie' }
        const entry: CardActionEntry = {
            cards: {},
            stackNameChanges: {
                a: { from: 'Joie', to: null },
                b: { from: null, to: 'Joie' },
            },
        }

        applyStackNameChanges(entry, stackNames, false)

        expect(stackNames).toEqual({ b: 'Joie' })

        applyStackNameChanges(entry, stackNames, true)

        expect(stackNames).toEqual({ a: 'Joie' })
    })
})
