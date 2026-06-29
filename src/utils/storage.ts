import { Card } from '../types/card.types'
import { Deck } from '../models/Deck.ts'

/**
 * Types describing the persisted layout state
 */
export interface SavedDeck {
    x: number
    y: number
    cards: string[]
}

export interface SavedState {
    decks: SavedDeck[]
}

const STORAGE_KEY: string = 'emotionCardsState'

/**
 * Save current decks layout (positions and card image mapping) to localStorage
 * @param decks - Array of decks currently on stage
 */
export function saveState(decks: Deck[]): void {
    const state: SavedState = {
        decks: decks.map((deck: Deck) => {
            const cards: string[] = []
            // Children[0] is the background; cards start from index 1
            for (let i: number = 1; i < deck.children.length; i++) {
                const child: Card = deck.children[i] as Card
                if (child && typeof child.imageUrl === 'string' && child.imageUrl.length > 0) {
                    cards.push(child.imageUrl)
                }
            }
            return {
                x: deck.x ?? 0,
                y: deck.y ?? 0,
                cards,
            }
        }),
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        // Ignore storage errors (e.g., quota exceeded or disabled storage)
    }
}

/**
 * Load a previously saved layout from localStorage
 * @returns Saved state if present and valid, otherwise null
 */
export function loadState(): SavedState | null {
    try {
        const raw: string | null = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return null
        }
        const parsed: unknown = JSON.parse(raw) as unknown
        if (!isValidState(parsed)) {
            return null
        }
        return parsed as SavedState
    } catch {
        return null
    }
}

/**
 * Type guard to validate parsed storage content
 */
function isValidState(value: unknown): value is SavedState {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v: { decks?: unknown } = value as { decks?: unknown }
    if (!Array.isArray(v.decks)) {
        return false
    }
    for (const d of v.decks) {
        const deck: { x?: unknown; y?: unknown; cards?: unknown } = d as { x?: unknown; y?: unknown; cards?: unknown }
        if (typeof deck.x !== 'number' || typeof deck.y !== 'number' || !Array.isArray(deck.cards)) {
            return false
        }
        for (const c of deck.cards) {
            if (typeof c !== 'string') {
                return false
            }
        }
    }
    return true
}
