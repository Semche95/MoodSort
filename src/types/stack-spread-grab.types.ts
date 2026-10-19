import type { Card } from './card.types'
import type { Position } from './position.types'

/** A spread card pressed but not moved yet: it only leaves the spread once the pointer moves. */
export interface StackSpreadGrab {
    card: Card
    /** Board card's top-left corner relative to the pointer, at board size */
    grabOffset: Position
}
