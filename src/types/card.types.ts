import { Sprite } from 'pixi.js'

/**
 * Interface extending PixiJS {@link Sprite} to represent a mood card.
 * A `Card` is any drawable image the user can pick and place.
 */
export interface Card extends Sprite {
    /** Source image URL — kept so it can be persisted for restore */
    imageUrl: string
}
