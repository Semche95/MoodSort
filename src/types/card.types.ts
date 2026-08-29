import { Container, Sprite } from 'pixi.js'

export interface Card extends Container {
    /** Atlas frame name used as card identity and persistence key */
    imageUrl: string
    /** The inner sprite holding the card image (used for tinting) */
    innerSprite: Sprite
}
