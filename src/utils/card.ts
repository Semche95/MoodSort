import { Assets, BlurFilter, Container, Graphics, Sprite, Texture, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'

/**
 * Constrains a position to keep it within the viewport using absolute window coordinates
 * @param x - The proposed x position (in global coordinates)
 * @param y - The proposed y position (in global coordinates)
 * @param width - The width of the object
 * @param height - The height of the object
 * @param appWidth - The width of the application
 * @param appHeight - The height of the application
 * @returns The constrained position (in global coordinates)
 */
export function constrainPosition(
    x: number,
    y: number,
    width: number,
    height: number,
    appWidth: number,
    appHeight: number,
): Position {
    const minX: number = 0
    const minY: number = 0
    const maxX: number = appWidth - width
    const maxY: number = appHeight - height

    return {
        x: Math.max(minX, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY)),
    }
}

/**
 * Creates a card sprite from an image
 * @param image - Path to the image to load
 * @param onDragStart - The function to call when the card is dragged
 * @returns Promise that resolves with the created card
 */
export async function createCard(
    image: string,
    onDragStart: (event: FederatedPointerEvent) => void,
): Promise<Card> {
    const texture: Texture = await Assets.load(image)

    const card: Card = new Container() as Card
    card.imageUrl = image

    const shadow: Graphics = new Graphics()
    shadow.roundRect(0, 0, texture.width, texture.height, 8)
    shadow.fill({ color: 0x000000, alpha: 0.25 })
    shadow.filters = [new BlurFilter({ strength: 4 })]
    shadow.x = 4
    shadow.y = 4
    card.addChild(shadow)

    const sprite: Sprite = new Sprite(texture)
    card.addChild(sprite)
    card.innerSprite = sprite

    card.eventMode = 'static'
    card.cursor = 'move'
    card.on('pointerdown', onDragStart, card)
    card.on('pointerover', (): void => { sprite.tint = 0xFFEEDD })
    card.on('pointerout', (): void => { sprite.tint = 0xFFFFFF })

    return card
}
