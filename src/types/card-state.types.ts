import { Position } from './position.types'
import { ViewportSize } from './viewport-size.types'

export interface CardState {
    positions: Record<string, Position>
    order: string[]
    onboardingDismissed: boolean
    /** Stack names keyed by the imageUrl of their anchor card (the stack's lowest z-order card). */
    stackNames: Record<string, string>
    /** Canvas size the positions were saved under, so a restore in a differently sized window can rescale them; null until a save records it. */
    viewport: ViewportSize | null
}

export const POSITIONS_KEY = 'positions' as const
export const ORDER_KEY = 'order' as const
export const ONBOARDING_KEY = 'onboardingDismissed' as const
export const STACK_NAMES_KEY = 'stackNames' as const
export const VIEWPORT_KEY = 'viewport' as const

/** Persisted shape of `CardState`, tagged with the schema version it was saved under so a migration can be detected on load. */
export interface StoredCardState extends CardState {
    schemaVersion: number
}
