import { Sprite } from 'pixi.js'

/**
 * Interface representing a card with its properties
 */
export interface Card extends Sprite {
    /**
     * Source image URL used to create this card (for persistence)
     */
    imageUrl?: string
}
