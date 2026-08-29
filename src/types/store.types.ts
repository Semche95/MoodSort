/**
 * Pure localStorage wrapper — no app-specific knowledge
 */
export interface IStore {
    save<T>(key: string, state: T): void
    load<T>(key: string): T | null
    clear(key: string): void
}
