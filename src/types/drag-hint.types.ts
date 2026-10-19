import type { Container, Ticker } from 'pixi.js'
import { Card } from './card.types'

/** A running "slide the top card out of the pile" nudge, stopped by its own timeline or the first pointer down. */
export interface DragHint {
    ticker: Ticker
    stage: Container
    card: Card
    elapsedMs: number
    tick: () => void
    stop: () => void
}
