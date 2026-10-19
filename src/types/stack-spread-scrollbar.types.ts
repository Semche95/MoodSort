import type { Box } from './box.types'

/** The spread's scrollbar, in stage px: the drawn track and thumb, and the wider strip that takes the pointer. */
export interface StackSpreadScrollbar {
    track: Box
    thumb: Box
    hitArea: Box
}
