import { Container, Ticker } from 'pixi.js'
import { Card } from '../../types/card.types'
import { DragHint } from '../../types/drag-hint.types'
import { lowerCard, raiseCard } from '../card/card-lift'
import { prefersReducedMotion } from '../../shared/utils/reduced-motion'

/** Just enough for the eye to land on the pile once the canvas is uncovered */
export const HINT_DELAY_MS: number = 500
export const HINT_NUDGE_MS: number = 1400
/** How far the card slides out of the pile, as a share of its own size */
export const HINT_SHIFT_X: number = 0.35
export const HINT_SHIFT_Y: number = -0.08

const SLIDE_OUT_END: number = 0.3
const SLIDE_BACK_START: number = 0.6

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function shouldPlayDragHint(): boolean {
    return !prefersReducedMotion()
}

/** Share of the full slide reached `elapsedMs` into one nudge: out, hold, then back. */
export function nudgeSlideAt(elapsedMs: number): number {
    const t = elapsedMs / HINT_NUDGE_MS
    if (t <= 0 || t >= 1) {
        return 0
    }
    if (t < SLIDE_OUT_END) {
        return easeOutCubic(t / SLIDE_OUT_END)
    }
    if (t < SLIDE_BACK_START) {
        return 1
    }
    return 1 - easeInOutCubic((t - SLIDE_BACK_START) / (1 - SLIDE_BACK_START))
}

/** Slide share over the whole hint (delay, then a single nudge), or null once the nudge has played. */
export function hintSlideAt(elapsedMs: number): number | null {
    const sinceStart = elapsedMs - HINT_DELAY_MS
    if (sinceStart < 0) {
        return 0
    }
    if (sinceStart >= HINT_NUDGE_MS) {
        return null
    }
    return nudgeSlideAt(sinceStart)
}

export function tickDragHint(hint: DragHint): void {
    hint.elapsedMs += hint.ticker.deltaMS
    const slide = hintSlideAt(hint.elapsedMs)
    if (slide === null) {
        hint.stop()
        return
    }
    const { width, height } = hint.card.innerSprite.texture
    hint.card.lift.offsetX = slide * width * HINT_SHIFT_X
    hint.card.lift.offsetY = slide * height * HINT_SHIFT_Y
    if (slide > 0) {
        raiseCard(hint.card, 'hint')
    } else {
        lowerCard(hint.card, 'hint')
    }
}

export function stopDragHint(hint: DragHint): void {
    hint.ticker.remove(hint.tick)
    hint.stage.off('pointerdown', hint.stop)
    hint.card.lift.offsetX = 0
    hint.card.lift.offsetY = 0
    lowerCard(hint.card, 'hint')
}

/** Nudges `card` out of the pile and back once, unless stopped by the first pointer down anywhere on the canvas. */
export function startDragHint(ticker: Ticker, stage: Container, card: Card): DragHint {
    const hint: DragHint = {
        ticker,
        stage,
        card,
        elapsedMs: 0,
        tick: (): void => tickDragHint(hint),
        stop: (): void => stopDragHint(hint),
    }
    ticker.add(hint.tick)
    stage.on('pointerdown', hint.stop)
    return hint
}
