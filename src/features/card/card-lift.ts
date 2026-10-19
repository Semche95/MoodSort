import { BlurFilter } from 'pixi.js'
import { Card } from '../../types/card.types'
import { CardLift, LiftReason } from '../../types/card-lift.types'
import { PixiThemePalette } from '../../types/pixi-theme-palette.types'

/** Body scale once fully raised */
export const LIFT_SCALE: number = 1.04
/** Card shadow offset (card-local px) at rest, so each card of a pile stands out from the one below */
export const REST_SHADOW_OFFSET_Y: number = 1
/** Card shadow offset (card-local px) once fully raised */
export const LIFT_SHADOW_OFFSET_Y: number = 18
/** Share of the remaining distance to the target covered per 60 fps frame */
const LIFT_EASING: number = 0.25
const LIFT_SNAP: number = 0.01

const liftBlurs: WeakMap<Card, BlurFilter> = new WeakMap()

function lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress
}

export function createCardLift(): CardLift {
    return { progress: 0, reasons: new Set(), offsetX: 0, offsetY: 0 }
}

export function raiseCard(card: Card, reason: LiftReason): void {
    card.lift.reasons.add(reason)
}

export function lowerCard(card: Card, reason: LiftReason): void {
    card.lift.reasons.delete(reason)
}

export function isCardDragged(card: Card): boolean {
    return card.lift.reasons.has('drag')
}

/** Eases `lift.progress` toward its target and returns whether it changed, so resting cards cost nothing per frame. */
export function stepCardLift(lift: CardLift, deltaFrames: number, instant: boolean): boolean {
    const target = lift.reasons.size > 0 ? 1 : 0
    if (lift.progress === target) {
        return false
    }
    const next = lift.progress + (target - lift.progress) * Math.min(1, LIFT_EASING * deltaFrames)
    lift.progress = instant || Math.abs(target - next) < LIFT_SNAP ? target : next
    return true
}

/** Scales the body around the card's center and morphs the shadow from a resting halo into a deeper drop shadow. */
export function applyCardLift(card: Card, shadowTheme: PixiThemePalette['card']['shadow']): void {
    const { progress, offsetX, offsetY } = card.lift
    const { width, height } = card.innerSprite.texture
    const scale = lerp(1, LIFT_SCALE, progress)
    card.body.scale.set(scale)
    card.body.x = (width * (1 - scale)) / 2 + offsetX
    card.body.y = (height * (1 - scale)) / 2 + offsetY

    const shadow = card.shadow
    shadow.tint = shadowTheme.color
    shadow.alpha = lerp(shadowTheme.restAlpha, shadowTheme.liftAlpha, progress)
    shadow.y = lerp(REST_SHADOW_OFFSET_Y, LIFT_SHADOW_OFFSET_Y, progress)
    if (progress === 0) {
        shadow.filters = []
        return
    }
    const blur = liftBlurs.get(card) ?? new BlurFilter()
    liftBlurs.set(card, blur)
    blur.strength = shadowTheme.liftBlurStrength * progress
    shadow.filters = [blur]
}

/** Per-frame update: only cards that are moving or still raised are redrawn. */
export function updateCardLifts(
    cards: Card[],
    deltaFrames: number,
    instant: boolean,
    shadowTheme: PixiThemePalette['card']['shadow'],
): void {
    for (const card of cards) {
        if (stepCardLift(card.lift, deltaFrames, instant) || card.lift.progress > 0) {
            applyCardLift(card, shadowTheme)
        }
    }
}
