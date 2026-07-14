import { Container } from 'pixi.js'
import { Card, CardState, POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY } from '../types/card.types'
import { Position } from '../types/position.types'
import { CardStateService } from '../services/CardStateService'

/**
 * Reads card positions from the stage and persists them via CardStateService.
 */
export class PositionPersistence {
    private store: CardStateService

    constructor(store: CardStateService) {
        this.store = store
    }

    save(state: CardState): void {
        this.store.save(state)
    }

    saveFromStage(stage: Container): void {
        const positions: Record<string, Position> = {}
        const order: string[] = []
        for (const child of stage.children) {
            const card: Card = child as Card
            if (card.imageUrl) {
                positions[card.imageUrl] = { x: card.x, y: card.y }
                order.push(card.imageUrl)
            }
        }
        this.store.save({ positions, order, onboardingDismissed: this.store.load(ONBOARDING_KEY) })
    }

    load(): CardState {
        return {
            positions: this.store.load(POSITIONS_KEY),
            order: this.store.load(ORDER_KEY),
            onboardingDismissed: this.store.load(ONBOARDING_KEY),
        }
    }

    clear(): void {
        this.store.save({
            positions: {},
            order: [],
            onboardingDismissed: this.store.load(ONBOARDING_KEY),
        })
    }
}
