import { describe, it, expect, vi } from 'vitest'
import {
    applyCardLift,
    createCardLift,
    isCardDragged,
    LIFT_SCALE,
    LIFT_SHADOW_OFFSET_Y,
    lowerCard,
    raiseCard,
    REST_SHADOW_OFFSET_Y,
    stepCardLift,
    updateCardLifts,
} from '../features/card/card-lift'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { Card } from '../types/card.types'

vi.mock('pixi.js', () => ({
    BlurFilter: class MockBlurFilter {
        strength: number = 0
    },
}))

const shadowTheme = getPixiThemeColors('light').card.shadow

type LiftableCard = Card & {
    body: { x: number; y: number; scale: { x: number; set(v: number): void } }
    shadow: { tint: number; alpha: number; y: number; filters: Array<{ strength: number }> }
}

function makeCard(): LiftableCard {
    const scale = { x: 1, set(v: number): void { scale.x = v } }
    return {
        lift: createCardLift(),
        innerSprite: { texture: { width: 200, height: 300 } },
        body: { x: 0, y: 0, scale },
        shadow: { tint: 0, alpha: 0, y: 0, filters: [] },
    } as unknown as LiftableCard
}

describe('createCardLift', () => {
    it('starts resting, unshifted and with no reason to be raised', () => {
        expect(createCardLift()).toEqual({ progress: 0, reasons: new Set(), offsetX: 0, offsetY: 0 })
    })
})

describe('raiseCard / lowerCard', () => {
    it('keeps the card raised until every reason that raised it is gone', () => {
        const card = makeCard()
        raiseCard(card, 'hint')
        raiseCard(card, 'drag')

        lowerCard(card, 'hint')
        expect(card.lift.reasons.size).toBe(1)

        lowerCard(card, 'drag')
        expect(card.lift.reasons.size).toBe(0)
    })
})

describe('isCardDragged', () => {
    it('tells a held card apart from one only raised by the drag hint', () => {
        const held = makeCard()
        const hinted = makeCard()
        raiseCard(held, 'drag')
        raiseCard(hinted, 'hint')

        expect(isCardDragged(held)).toBe(true)
        expect(isCardDragged(hinted)).toBe(false)
    })
})

describe('stepCardLift', () => {
    it('reports no change for a resting card with nothing raising it', () => {
        const lift = createCardLift()

        expect(stepCardLift(lift, 1, false)).toBe(false)
        expect(lift.progress).toBe(0)
    })

    it('moves part of the way toward fully raised each frame, and further with a larger frame delta', () => {
        const slow = createCardLift()
        const fast = createCardLift()
        slow.reasons.add('drag')
        fast.reasons.add('drag')

        expect(stepCardLift(slow, 1, false)).toBe(true)
        stepCardLift(fast, 2, false)

        expect(slow.progress).toBeGreaterThan(0)
        expect(fast.progress).toBeGreaterThan(slow.progress)
        expect(fast.progress).toBeLessThan(1)
    })

    it('snaps to the target once close enough, so the lift actually settles', () => {
        const lift = createCardLift()
        lift.progress = 0.995
        lift.reasons.add('drag')

        stepCardLift(lift, 1, false)

        expect(lift.progress).toBe(1)
    })

    it('jumps straight to the target when instant', () => {
        const lift = createCardLift()
        lift.progress = 1

        stepCardLift(lift, 1, true)

        expect(lift.progress).toBe(0)
    })
})

describe('applyCardLift', () => {
    it('leaves a resting card at its natural size with an unblurred halo shadow', () => {
        const card = makeCard()

        applyCardLift(card, shadowTheme)

        expect(card.body.scale.x).toBe(1)
        expect(card.body.x).toBe(0)
        expect(card.body.y).toBe(0)
        expect(card.shadow.tint).toBe(shadowTheme.color)
        expect(card.shadow.alpha).toBe(shadowTheme.restAlpha)
        expect(card.shadow.y).toBe(REST_SHADOW_OFFSET_Y)
        expect(card.shadow.filters).toEqual([])
    })

    it('grows a fully raised card around its center and casts a soft, deeper shadow', () => {
        const card = makeCard()
        card.lift.progress = 1

        applyCardLift(card, shadowTheme)

        expect(card.body.scale.x).toBe(LIFT_SCALE)
        expect(card.body.x).toBeCloseTo((200 * (1 - LIFT_SCALE)) / 2)
        expect(card.body.y).toBeCloseTo((300 * (1 - LIFT_SCALE)) / 2)
        expect(card.shadow.alpha).toBe(shadowTheme.liftAlpha)
        expect(card.shadow.y).toBe(LIFT_SHADOW_OFFSET_Y)
        expect(card.shadow.filters[0].strength).toBe(shadowTheme.liftBlurStrength)
    })

    it('shifts only the body by the lift offset, never the card itself', () => {
        const card = makeCard()
        card.x = 40
        card.lift.offsetX = 25
        card.lift.offsetY = -10

        applyCardLift(card, shadowTheme)

        expect(card.body.x).toBe(25)
        expect(card.body.y).toBe(-10)
        expect(card.x).toBe(40)
    })

    it('reuses the same blur filter across frames instead of allocating one per frame', () => {
        const card = makeCard()
        card.lift.progress = 0.5
        applyCardLift(card, shadowTheme)
        const first = card.shadow.filters[0]

        card.lift.progress = 0.8
        applyCardLift(card, shadowTheme)

        expect(card.shadow.filters[0]).toBe(first)
    })
})

describe('updateCardLifts', () => {
    it('redraws a card that is settling and leaves untouched cards alone', () => {
        const settling = makeCard()
        settling.lift.progress = 1
        const resting = makeCard()

        updateCardLifts([settling, resting], 1, false, shadowTheme)

        expect(settling.lift.progress).toBeLessThan(1)
        expect(settling.shadow.tint).toBe(shadowTheme.color)
        expect(resting.shadow.tint).toBe(0)
    })
})
