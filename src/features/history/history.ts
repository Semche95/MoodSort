import { Container } from 'pixi.js'
import { Card } from '../../types/card.types'
import { CardActionEntry, HistorySnapshot } from '../../types/history.types'

export function initHistoryShortcuts(doUndo: () => void, doRedo: () => void): void {
    const mod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey

    window.addEventListener('keydown', (e: KeyboardEvent): void => {
        if (!mod(e)) return
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault()
            doUndo()
        } else if (e.key.toLowerCase() === 'z' && e.shiftKey) {
            e.preventDefault()
            doRedo()
        } else if (e.key === 'y') {
            e.preventDefault()
            doRedo()
        }
    })
}

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

/** Applies the stack-name side of a history entry (if any) back onto a live stackNames map: `reverse` picks the "from" side, otherwise the "to" side. */
export function applyStackNameChanges(
    entry: CardActionEntry,
    stackNames: Record<string, string>,
    reverse: boolean,
): void {
    if (!entry.stackNameChanges) {
        return
    }
    for (const [id, change] of Object.entries(entry.stackNameChanges)) {
        const value = reverse ? change.from : change.to
        if (value === null) {
            delete stackNames[id]
        } else {
            stackNames[id] = value
        }
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
        const insertAt = Math.min(index, stage.children.length)
        stage.addChildAt(card, insertAt)
    }
}
