import { CardState } from '../../types/card-state.types'
import { Store } from '../../shared/utils/store'
import { IStore } from '../../types/store.types'

const STORAGE_KEY: string = 'moodsort-card-state'

/**
 * Bumped whenever CardState gains a field that older saved blobs won't have,
 * so load() can tell a genuinely-missing field apart from an intentional
 * empty value and re-save the migrated shape once.
 */
const CARD_STATE_SCHEMA_VERSION: number = 2

const DEFAULTS: CardState = { positions: {}, order: [], onboardingDismissed: false, stackNames: {} }

interface StoredCardState extends CardState {
    schemaVersion: number
}

export class CardStateService {
    private store: IStore
    private migrated: boolean = false

    constructor(store: IStore = new Store()) {
        this.store = store
    }

    /** True once a load() has migrated a pre-stackNames saved blob to the current schema. */
    get wasMigrated(): boolean {
        return this.migrated
    }

    save(state: CardState): void {
        this.store.save<StoredCardState>(STORAGE_KEY, { ...state, schemaVersion: CARD_STATE_SCHEMA_VERSION })
    }

    load<K extends keyof CardState>(key: K): CardState[K] {
        return this.loadFullState()[key]
    }

    clear(): void {
        this.store.clear(STORAGE_KEY)
    }

    private loadFullState(): CardState {
        const raw = this.store.load<Partial<StoredCardState>>(STORAGE_KEY)
        if (!raw) {
            return DEFAULTS
        }
        const needsMigration = raw.schemaVersion === undefined || raw.schemaVersion < CARD_STATE_SCHEMA_VERSION
        const state: CardState = {
            positions: raw.positions ?? DEFAULTS.positions,
            order: raw.order ?? DEFAULTS.order,
            onboardingDismissed: raw.onboardingDismissed ?? DEFAULTS.onboardingDismissed,
            stackNames: raw.stackNames ?? DEFAULTS.stackNames,
        }
        if (needsMigration) {
            this.migrated = true
            this.save(state)
        }
        return state
    }
}
