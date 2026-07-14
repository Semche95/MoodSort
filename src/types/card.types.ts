import { Container, Sprite } from 'pixi.js'
import { Position } from './position.types'

export interface CardState {
    positions: Record<string, Position>
    order: string[]
    onboardingDismissed: boolean
}

export const POSITIONS_KEY = 'positions' as const
export const ORDER_KEY = 'order' as const
export const ONBOARDING_KEY = 'onboardingDismissed' as const
export const HISTORY_KEY = 'moodsort-history' as const

export interface AnimationTarget {
    card: Card
    fromX: number
    fromY: number
    toX: number
    toY: number
}

export interface CardActionEntry {
    cards: Record<string, {
        fromX: number
        fromY: number
        fromIndex: number
        toX: number
        toY: number
        toIndex: number
    }>
}

export interface HistoryData {
    undoStack: CardActionEntry[]
    redoStack: CardActionEntry[]
}

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
