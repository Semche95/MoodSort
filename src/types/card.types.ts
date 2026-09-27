import { Container, Graphics, Sprite } from 'pixi.js'

export interface Card extends Container {
    /** Atlas frame name used as card identity and persistence key */
    imageUrl: string
    /** The inner sprite holding the card image (used for tinting) */
    innerSprite: Sprite
    /** The drop shadow drawn under the card (redrawn on theme change) */
    shadow: Graphics
}
