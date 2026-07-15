import { Assets, BlurFilter, Container, Graphics, Sprite, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from '../types/position.types'

function cardsOverlap(a: Card, b: Card): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    )
}

export function findStack(card: Card, allCards: Card[]): Card[] {
    const stack: Card[] = []
    const visited = new Set<Card>()
    const queue = [card]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        stack.push(current)
        for (const other of allCards) {
            if (!visited.has(other) && cardsOverlap(current, other)) {
                queue.push(other)
            }
        }
    }
    return stack
}

export function computeBoundingBox(cards: Card[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const card of cards) {
        minX = Math.min(minX, card.x)
        minY = Math.min(minY, card.y)
        maxX = Math.max(maxX, card.x + card.width)
        maxY = Math.max(maxY, card.y + card.height)
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

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
    const minX = 0
    const minY = 0
    const maxX = appWidth - width
    const maxY = appHeight - height

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
    const texture = await Assets.load(image)

    const card = new Container() as Card
    card.imageUrl = image

    const shadow = new Graphics()
    shadow.roundRect(0, 0, texture.width, texture.height, 8)
    shadow.fill({ color: 0x000000, alpha: 0.25 })
    shadow.filters = [new BlurFilter({ strength: 4 })]
    shadow.x = 4
    shadow.y = 4
    card.addChild(shadow)

    const sprite = new Sprite(texture)
    card.addChild(sprite)
    card.innerSprite = sprite

    card.eventMode = 'static'
    card.cursor = 'move'
    card.on('pointerdown', onDragStart, card)
    card.on('pointerover', (): void => { sprite.tint = 0xFFEEDD })
    card.on('pointerout', (): void => { sprite.tint = 0xFFFFFF })

    return card
}
