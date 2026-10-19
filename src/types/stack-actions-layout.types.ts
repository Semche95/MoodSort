import type { Box } from './box.types'
import type { Card } from './card.types'

/** A button of the pill on a stack frame's bottom edge */
export type StackAction = 'compact' | 'spread'

/** Where the bottom pill and each of its buttons sit, in stage px. */
export type StackActionsLayout = { pill: Box } & Record<StackAction, Box>

/** A bottom-pill button found under the pointer, with the stack it acts on */
export interface StackActionHit {
    stack: Card[]
    action: StackAction
}
