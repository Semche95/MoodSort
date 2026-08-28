import { Card } from './card.types'

export interface AnimationTarget {
    card: Card
    fromX: number
    fromY: number
    toX: number
    toY: number
}
