import type { Box } from './box.types'

/** Where the spread's top pill, its label and its close button sit, in stage px. */
export interface StackSpreadPillLayout {
    pill: Box
    /** Left edge and vertical center of the label text */
    label: { x: number; y: number }
    close: Box
}
