/** Why a card is raised off the table; it settles back only once every reason is gone. */
export type LiftReason = 'drag' | 'hint'

export interface CardLift {
    /** 0 resting on the table, 1 fully raised, eased toward its target every frame */
    progress: number
    reasons: Set<LiftReason>
    /** Visual-only shift of the card body (card-local px), never applied to the card's own position */
    offsetX: number
    offsetY: number
}
