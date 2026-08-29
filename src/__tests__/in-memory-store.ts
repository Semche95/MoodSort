import { IStore } from '../types/store.types'

/**
 * In-memory implementation of IStore for testing — no localStorage dependency
 */
export class InMemoryStore implements IStore {
    private data: Record<string, unknown> = {}

    save<T>(key: string, state: T): void {
        this.data[key] = JSON.parse(JSON.stringify(state))
    }

    load<T>(key: string): T | null {
        if (key in this.data) {
            return JSON.parse(JSON.stringify(this.data[key])) as T
        }
        return null
    }

    clear(key: string): void {
        delete this.data[key]
    }
}
