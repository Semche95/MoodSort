import type { AlphaFilter, BlurFilter, Container, Graphics } from 'pixi.js'

/** The single blurred shadow drawn under every pile, kept with its filters so a theme change only retunes them. */
export interface StackShadow {
    /** Holds the graphics and caches its blurred render; the one to add to the stage */
    view: Container
    graphics: Graphics
    blur: BlurFilter
    alpha: AlphaFilter
    /** Card layout last drawn and cached, see computeCardLayoutKey; empty to force the next redraw */
    layoutKey: string
}
