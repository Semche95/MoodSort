import type { Box } from './box.types'

/** Where a stack's frame and top pill (grip, optional name, rename button) sit, in stage px. */
export interface StackPillLayout {
    frame: Box
    pill: Box
    grip: Box
    /** Left edge and vertical center of the name text, or null when the stack is unnamed */
    name: { x: number; y: number } | null
    pencil: Box
}
