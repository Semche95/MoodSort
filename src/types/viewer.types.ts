import { Card } from './card.types'
import type { Deck } from '../models/Deck'

export interface DeckViewerDropDetail {
    card: Card
    x: number
    y: number
}

export interface DeckViewerOpenDetail {
    cards: Card[]
    index: number
    deck: Deck
}

export interface DeckViewerHoverDetail {
    x: number
    y: number
    width: number
    height: number
}
