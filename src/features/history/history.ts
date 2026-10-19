import { Container } from 'pixi.js'
import { Card } from '../../types/card.types'
import { CardActionEntry, HistorySnapshot } from '../../types/history.types'
import { findStack } from '../stack/stack'

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

/** Anchors each card to an untouched card of its pile, if any, so the pile can be found again after a resize. */
export function snapshotCards(cards: Card[], stage: Container): HistorySnapshot[] {
    const allCards = stage.children.filter((child: Container): child is Card => (child as Card).imageUrl !== undefined)
    const snapshotted = new Set<Card>(cards)
    return cards.map((card: Card): HistorySnapshot => {
        const snapshot: HistorySnapshot = {
            id: card.imageUrl,
            x: card.x,
            y: card.y,
            index: stage.children.indexOf(card),
        }
        const anchor = findStack(card, allCards).find((other: Card): boolean => !snapshotted.has(other))
        if (anchor) {
            snapshot.anchor = {
                id: anchor.imageUrl,
                dx: (card.x - anchor.x) / anchor.scale.x,
                dy: (card.y - anchor.y) / anchor.scale.y,
            }
        }
        return snapshot
    })
}

/**
 * Applies a history entry back onto the stage: `reverse` picks the "from"
 * side, otherwise the "to" side. An anchored card is placed relative to its
 * anchor's current position and scale; the others get their recorded
 * coordinates, still in the entry's canvas size, and are returned so the
 * caller can rescale them.
 */
export function applyHistoryEntry(
    entry: CardActionEntry,
    allCards: Card[],
    stage: Container,
    reverse: boolean,
): Card[] {
    const affected: Array<{ card: Card; index: number }> = []
    const unanchored: Card[] = []

    for (const [imageUrl, data] of Object.entries(entry.cards)) {
        const card = allCards.find((c: Card): boolean => c.imageUrl === imageUrl)
        if (!card) {
            continue
        }
        const index = reverse ? data.fromIndex : data.toIndex
        const anchor = reverse ? data.fromAnchor : data.toAnchor
        const anchorCard = anchor && allCards.find((c: Card): boolean => c.imageUrl === anchor.id)
        if (anchor && anchorCard) {
            card.x = anchorCard.x + anchor.dx * anchorCard.scale.x
            card.y = anchorCard.y + anchor.dy * anchorCard.scale.y
        } else {
            card.x = reverse ? data.fromX : data.toX
            card.y = reverse ? data.fromY : data.toY
            unanchored.push(card)
        }
        affected.push({ card, index })
    }

    restoreCardZIndices(stage, affected)
    return unanchored
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
