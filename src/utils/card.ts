import { Assets, Sprite, Texture, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Deck } from '../models/Deck'
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
    // Use absolute window coordinates to constrain the position
    // Ensure objects stay fully visible within the viewport
    // Objects can't be even partially off-screen
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
 * Adds a card to the canvas
 * @param image - Path to the image to load
 * @param deck - The deck to add the card to
 * @param onDragStart - The function to call when the card is dragged
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param decks - Array of all decks
 * @param onTitleBarClick - The function to call when the title bar is clicked
 * @returns Promise that resolves with the card dimensions when the card is added
 */
export async function addCard(
    image: string, 
    deck: Deck, 
    onDragStart: (event: FederatedPointerEvent) => void,
    deckWidth: number,
    deckHeight: number,
    decks: Deck[],
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
): Promise<{ width: number, height: number }> {
    const texture: Texture = await Assets.load(image)

    const card: Card = new Sprite(texture) as Card
    card.imageUrl = image
    card.eventMode = 'static'
    card.cursor = 'move'
    card.on('pointerdown', onDragStart, card)

    // Add the card to the deck
    deck.addChild(card)

    // Center the card within the deck
    deck.centerCard(card, deckWidth, deckHeight)

    // Update the deck background with the new card count
    if (decks.includes(deck)) {
        deck.updateBorder(false, deckWidth, deckHeight, onTitleBarClick)
    }

    return {
        width: card.width,
        height: card.height,
    }
}
