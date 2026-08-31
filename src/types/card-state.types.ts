import { Position } from './position.types'

export interface CardState {
    positions: Record<string, Position>
    order: string[]
    onboardingDismissed: boolean
    /** Stack names keyed by the imageUrl of their anchor card (the stack's lowest z-order card). */
    stackNames: Record<string, string>
}

export const POSITIONS_KEY = 'positions' as const
export const ORDER_KEY = 'order' as const
export const ONBOARDING_KEY = 'onboardingDismissed' as const
export const STACK_NAMES_KEY = 'stackNames' as const
