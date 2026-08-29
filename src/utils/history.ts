import { Container } from 'pixi.js'
import { Card } from '../types/card.types'
import { CardActionEntry, HistorySnapshot } from '../types/history.types'

export function snapshotCards(cards: Card[], stage: Container): HistorySnapshot[] {
    return cards.map((card: Card): HistorySnapshot => ({
        id: card.imageUrl,
        x: card.x,
        y: card.y,
        index: stage.children.indexOf(card),
    }))
}

/** Applies a history entry back onto the stage: `reverse` picks the "from" side, otherwise the "to" side. */
export function applyHistoryEntry(
    entry: CardActionEntry,
    allCards: Card[],
    stage: Container,
    reverse: boolean,
): void {
    const affected: Array<{ card: Card; index: number }> = []

    for (const [imageUrl, data] of Object.entries(entry.cards)) {
        const card = allCards.find((c: Card): boolean => c.imageUrl === imageUrl)
        if (!card) {
            continue
        }
        const index = reverse ? data.fromIndex : data.toIndex
        card.x = reverse ? data.fromX : data.toX
        card.y = reverse ? data.fromY : data.toY
        affected.push({ card, index })
    }

    restoreCardZIndices(stage, affected)
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
        const insertAt = Math.min(index, stage.children.length)
        stage.addChildAt(card, insertAt)
    }
}
