import { Graphics } from 'pixi.js'

/** The four state views (default/hover/pressed/disabled) shared by every round or pill-shaped toolbar button. */
export interface RoundButtonViews {
    defaultView: Graphics
    hoverView: Graphics
    pressedView: Graphics
    disabledView: Graphics
}
