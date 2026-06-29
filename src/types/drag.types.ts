import { Container, Sprite } from 'pixi.js'
import { Position } from './position.types'

/**
 * Interface representing the state of a card drag operation
 */
export interface CardDragState {
    dragTarget: Sprite | null
    dragOffset: Position
    originalParent: Container | null
    originalPosition: Position
    cardMoved: boolean
}

/**
 * Interface representing the state of a deck drag operation
 */
export interface DeckDragState {
    dragDeckTarget: Container | null
    dragDeckOffset: Position
}
