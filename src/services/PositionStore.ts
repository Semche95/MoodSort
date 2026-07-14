import { Position } from '../types/position.types'

/**
 * Interface for position persistence — allows swapping storage backends for testing
 */
export interface IPositionStore {
    save(positions: Record<string, Position>): void
    load(): Record<string, Position>
    clear(): void
}

/**
 * Persists card positions to localStorage
 */
export class PositionStore implements IPositionStore {
    private key: string

    constructor(key: string = 'moodsort-card-positions') {
        this.key = key
    }

    save(positions: Record<string, Position>): void {
        try {
            localStorage.setItem(this.key, JSON.stringify(positions))
        } catch {
            // localStorage unavailable
        }
    }

    load(): Record<string, Position> {
        try {
            const raw: string | null = localStorage.getItem(this.key)
            if (raw) {
                const parsed: unknown = JSON.parse(raw)
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed as Record<string, Position>
                }
            }
        } catch {
            // localStorage unavailable or corrupt
        }
        return {}
    }

    clear(): void {
        try {
            localStorage.removeItem(this.key)
        } catch {
            // localStorage unavailable
        }
    }
}

/**
 * In-memory implementation for testing — no localStorage dependency
 */
export class InMemoryPositionStore implements IPositionStore {
    private data: Record<string, Position> = {}

    save(positions: Record<string, Position>): void {
        this.data = { ...positions }
    }

    load(): Record<string, Position> {
        return JSON.parse(JSON.stringify(this.data)) as Record<string, Position>
    }

    clear(): void {
        this.data = {}
    }
}
