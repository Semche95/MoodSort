import { Position } from './position.types'

export interface CardState {
    positions: Record<string, Position>
    order: string[]
    onboardingDismissed: boolean
}

export const POSITIONS_KEY = 'positions' as const
export const ORDER_KEY = 'order' as const
export const ONBOARDING_KEY = 'onboardingDismissed' as const
