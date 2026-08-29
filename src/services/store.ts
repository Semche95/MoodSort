import { IStore } from '../types/store.types'

export class Store implements IStore {
    save<T>(key: string, state: T): void {
        try {
            localStorage.setItem(key, JSON.stringify(state))
        } catch {
            // localStorage unavailable
        }
    }

    load<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(key)
            if (raw) {
                const parsed: unknown = JSON.parse(raw)
                if (parsed !== null) {
                    return parsed as T
                }
            }
        } catch {
            // localStorage unavailable or corrupt
        }
        return null
    }

    clear(key: string): void {
        try {
            localStorage.removeItem(key)
        } catch {
            // localStorage unavailable
        }
    }
}
