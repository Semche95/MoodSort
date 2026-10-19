import type { AlphaFilter, BlurFilter, Graphics } from 'pixi.js'

/** The single blurred shadow drawn under every pile, kept with its filters so a theme change only retunes them. */
export interface StackShadow {
    graphics: Graphics
    blur: BlurFilter
    alpha: AlphaFilter
}
