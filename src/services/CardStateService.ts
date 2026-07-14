import { CardState } from '../types/card.types'
import { IStore } from './Store'

const STORAGE_KEY: string = 'moodsort-card-state'

const DEFAULTS: CardState = { positions: {}, order: [], onboardingDismissed: false }

/**
 * Application-level service for card state persistence.
 * Delegates storage to a generic IStore instance.
 */
export class CardStateService {
    private store: IStore

    constructor(store: IStore) {
        this.store = store
    }

    save(state: CardState): void {
        this.store.save<CardState>(STORAGE_KEY, state)
    }

    load<K extends keyof CardState>(key: K): CardState[K] {
        const state: CardState = this.store.load<CardState>(STORAGE_KEY) ?? DEFAULTS
        return state[key]
    }

    clear(): void {
        this.store.clear(STORAGE_KEY)
    }
}
