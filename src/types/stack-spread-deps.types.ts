import type { FederatedPointerEvent } from 'pixi.js'
import type { Card } from './card.types'
import type { Position } from './position.types'
import type { GetResolvedTheme } from './theme.types'

export interface StackSpreadDeps {
    getStackNames: () => Record<string, string>
    getResolvedTheme: GetResolvedTheme
    /** Whether a card is being dragged on the board, e.g. one just pulled out of the spread */
    isDragging: () => boolean
    /** A spread card was pressed then moved: the board card must start a regular drag from `e`, its corner `grabOffset` from the pointer. */
    onCardGrab: (card: Card, e: FederatedPointerEvent, grabOffset: Position) => void
}
