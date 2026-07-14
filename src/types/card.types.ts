import { Container, Sprite } from 'pixi.js'

/**
 * Interface extending PixiJS {@link Container} to represent a mood card.
 * A `Card` wraps a shadow layer and an inner sprite.
 */
export interface Card extends Container {
    /** Source image URL — kept so it can be persisted for restore */
    imageUrl: string
    /** The inner sprite holding the card image (used for tinting) */
    innerSprite: Sprite
}
