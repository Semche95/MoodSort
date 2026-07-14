import { Container } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from './position.types'

/**
 * Interface representing the state of a card drag operation
 */
export interface CardDragState {
    dragTarget: Card | null
    dragOffset: Position
    originalParent: Container | null
    originalPosition: Position
    cardMoved: boolean
}
