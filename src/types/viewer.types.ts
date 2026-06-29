import { Card } from './card.types'

export interface DeckViewerDropDetail {
    card: Card
    x: number
    y: number
}

export interface DeckViewerOpenDetail {
    cards: Card[]
    index: number
}

export interface DeckViewerHoverDetail {
    x: number
    y: number
    width: number
    height: number
}
