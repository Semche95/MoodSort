/**
 * Pure localStorage wrapper — no app-specific knowledge
 */
export interface IStore {
    save<T>(key: string, state: T): void
    load<T>(key: string): T | null
    clear(key: string): void
}

/**
 * Generic localStorage-backed store
 */
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

/**
 * In-memory implementation for testing — no localStorage dependency
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
