import type { Card } from './card.types'
import type { StackPillLayout } from './stack-pill-layout.types'

/** One stationary stack as drawn on the last frame, kept for hit testing its pill and showing its tooltips. */
export interface StackOverlayEntry {
    stack: Card[]
    layout: StackPillLayout
    label: string
    truncated: boolean
}
