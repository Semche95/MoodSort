import { describe, it, expect } from 'vitest'
import type { Container } from 'pixi.js'
import { snapshotCards, applyHistoryEntry, applyStackNameChanges } from '../features/history/history'
import { Card } from '../types/card.types'
import { CardActionEntry, HistoryAnchor, HistorySnapshot } from '../types/history.types'

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
    width: number = 100
    height: number = 150
    scale: { x: number; y: number } = { x: 0.5, y: 0.5 }
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

    it('anchors a card to an untouched card of its pile, with the offset in card-scale units', () => {
        const pile = new FakeCard('pile', 10, 20)
        const moved = new FakeCard('moved', 40, 60)
        const stage = makeStage([pile, moved])

        const [snapshot] = snapshotCards([moved] as unknown as Card[], stage as unknown as Container)

        expect(snapshot.anchor).toEqual({ id: 'pile', dx: 60, dy: 80 })
    })

    it('leaves a card unanchored when its whole pile is snapshotted or it stands alone', () => {
        const a = new FakeCard('a', 10, 20)
        const b = new FakeCard('b', 40, 60)
        const lone = new FakeCard('lone', 500, 500)
        const stage = makeStage([a, b, lone])

        const snapshots = snapshotCards([a, b, lone] as unknown as Card[], stage as unknown as Container)

        expect(snapshots.map((s: HistorySnapshot): HistoryAnchor | undefined => s.anchor)).toEqual([undefined, undefined, undefined])
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

    it('places an anchored card relative to its anchor\'s current position and scale, and returns only the unanchored cards', () => {
        const pile = new FakeCard('pile', 200, 300)
        pile.scale = { x: 2, y: 2 }
        const a = new FakeCard('a', 0, 0)
        const b = new FakeCard('b', 0, 0)
        const stage = makeStage([pile, a, b])
        const entry: CardActionEntry = {
            cards: {
                a: { fromX: 10, fromY: 20, fromIndex: 1, toX: 100, toY: 200, toIndex: 1, toAnchor: { id: 'pile', dx: 15, dy: 25 } },
                b: { fromX: 30, fromY: 40, fromIndex: 2, toX: 300, toY: 400, toIndex: 2 },
            },
        }

        const unanchored = applyHistoryEntry(entry, [pile, a, b] as unknown as Card[], stage as unknown as Container, false)

        expect({ x: a.x, y: a.y }).toEqual({ x: 230, y: 350 })
        expect({ x: b.x, y: b.y }).toEqual({ x: 300, y: 400 })
        expect(unanchored).toEqual([b])
    })

    it('falls back to the recorded coordinates when the anchor card is gone', () => {
        const a = new FakeCard('a', 0, 0)
        const stage = makeStage([a])
        const entry: CardActionEntry = {
            cards: { a: { fromX: 10, fromY: 20, fromIndex: 0, toX: 100, toY: 200, toIndex: 0, fromAnchor: { id: 'gone', dx: 15, dy: 25 } } },
        }

        const unanchored = applyHistoryEntry(entry, [a] as unknown as Card[], stage as unknown as Container, true)

        expect({ x: a.x, y: a.y }).toEqual({ x: 10, y: 20 })
        expect(unanchored).toEqual([a])
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
