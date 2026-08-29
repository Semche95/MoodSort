import { Container } from 'pixi.js'
import { Card } from '../types/card.types'
import { Position } from './position.types'

export interface CardDragState {
    dragTarget: Card | null
    dragOffset: Position
    originalParent: Container | null
    originalPosition: Position
    cardMoved: boolean
}
