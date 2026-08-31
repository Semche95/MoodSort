import { Container } from 'pixi.js'
import { Card } from '../../types/card.types'
import { CardState, POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY, STACK_NAMES_KEY } from '../../types/card-state.types'
import { Position } from '../../types/position.types'
import { CardStateService } from './card-state-service'

const URL_PREFIX_RE = /^\/assets\/(.+)-[A-Za-z0-9_-]+\.webp$/

function extractFrameName(url: string): string | null {
    const match = url.match(URL_PREFIX_RE)
    return match ? match[1] : null
}

function migrateKeys(
    positions: Record<string, Position>,
    order: string[],
): { positions: Record<string, Position>; order: string[]; migrated: boolean } {
    let migrated: boolean = false
    const newPositions: Record<string, Position> = {}
    for (const [key, value] of Object.entries(positions)) {
        const frameName = extractFrameName(key)
        if (frameName) {
            newPositions[frameName] = value
            migrated = true
        } else {
            newPositions[key] = value
        }
    }
    const newOrder = order.map((key: string): string => {
        const frameName = extractFrameName(key)
        if (frameName) {
            migrated = true
            return frameName
        }
        return key
    })
    return { positions: newPositions, order: newOrder, migrated }
}

export class PositionPersistence {
    private store: CardStateService
    private migrated: boolean = false

    constructor(store: CardStateService) {
        this.store = store
    }

    save(state: CardState): void {
        this.store.save(state)
    }

    saveFromStage(stage: Container, stackNames: Record<string, string> = {}): void {
        const positions: Record<string, Position> = {}
        const order: string[] = []
        for (const child of stage.children) {
            const card = child as Card
            if (card.imageUrl) {
                positions[card.imageUrl] = { x: card.x, y: card.y }
                order.push(card.imageUrl)
            }
        }
        this.store.save({ positions, order, onboardingDismissed: this.store.load(ONBOARDING_KEY), stackNames })
    }

    load(): CardState {
        const rawPositions = this.store.load(POSITIONS_KEY)
        const rawOrder = this.store.load(ORDER_KEY)
        const stackNames = this.store.load(STACK_NAMES_KEY)
        const { positions, order, migrated } = migrateKeys(rawPositions, rawOrder)
        if (migrated) {
            this.migrated = true
            this.store.save({
                positions,
                order,
                onboardingDismissed: this.store.load(ONBOARDING_KEY),
                stackNames,
            })
        }
        return {
            positions,
            order,
            onboardingDismissed: this.store.load(ONBOARDING_KEY),
            stackNames,
        }
    }

    get wasMigrated(): boolean {
        return this.migrated
    }

    clear(): void {
        this.store.save({
            positions: {},
            order: [],
            onboardingDismissed: this.store.load(ONBOARDING_KEY),
            stackNames: {},
        })
    }
}
