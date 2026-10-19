import type { Text } from 'pixi.js'

/** A pooled name text for one frame, with whether it had to be shortened to fit its pill. */
export interface StackLabel {
    text: Text
    truncated: boolean
}
