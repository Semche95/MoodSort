import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Container, Ticker } from 'pixi.js'
import {
    HINT_DELAY_MS,
    HINT_NUDGE_MS,
    HINT_SHIFT_X,
    HINT_SHIFT_Y,
    hintSlideAt,
    nudgeSlideAt,
    shouldPlayDragHint,
    startDragHint,
    stopDragHint,
    tickDragHint,
} from '../features/onboarding/drag-hint'
import { createCardLift } from '../features/card/card-lift'
import { Card } from '../types/card.types'

vi.mock('pixi.js', () => ({
    BlurFilter: class MockBlurFilter {},
}))

function makeCard(): Card {
    return { lift: createCardLift(), innerSprite: { texture: { width: 200, height: 300 } } } as unknown as Card
}

function makeTicker(deltaMS: number = 0): Ticker & { callbacks: Array<() => void> } {
    const callbacks: Array<() => void> = []
    return {
        deltaMS,
        callbacks,
        add: vi.fn((fn: () => void): void => { callbacks.push(fn) }),
        remove: vi.fn((fn: () => void): void => { callbacks.splice(callbacks.indexOf(fn), 1) }),
    } as unknown as Ticker & { callbacks: Array<() => void> }
}

function makeStage(): Container & { handlers: Map<string, () => void> } {
    const handlers = new Map<string, () => void>()
    return {
        handlers,
        on: vi.fn((event: string, fn: () => void): void => { handlers.set(event, fn) }),
        off: vi.fn((event: string): void => { handlers.delete(event) }),
    } as unknown as Container & { handlers: Map<string, () => void> }
}

describe('shouldPlayDragHint', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('plays when motion is fine', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))

        expect(shouldPlayDragHint()).toBe(true)
    })

    it('never plays for users who prefer reduced motion', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))

        expect(shouldPlayDragHint()).toBe(false)
    })
})

describe('nudgeSlideAt', () => {
    it('slides out, holds fully out mid-nudge, and is back in place at both ends', () => {
        expect(nudgeSlideAt(0)).toBe(0)
        expect(nudgeSlideAt(HINT_NUDGE_MS * 0.15)).toBeGreaterThan(0)
        expect(nudgeSlideAt(HINT_NUDGE_MS * 0.45)).toBe(1)
        expect(nudgeSlideAt(HINT_NUDGE_MS * 0.8)).toBeLessThan(1)
        expect(nudgeSlideAt(HINT_NUDGE_MS)).toBe(0)
    })
})

describe('hintSlideAt', () => {
    it('waits out the initial delay with the card in place', () => {
        expect(hintSlideAt(HINT_DELAY_MS - 1)).toBe(0)
    })

    it('plays a single nudge, then reports the hint as finished', () => {
        expect(hintSlideAt(HINT_DELAY_MS + HINT_NUDGE_MS * 0.45)).toBe(1)
        expect(hintSlideAt(HINT_DELAY_MS + HINT_NUDGE_MS)).toBeNull()
    })
})

describe('startDragHint', () => {
    it('ticks on the ticker and stops at the first pointer down on the stage', () => {
        const ticker = makeTicker()
        const stage = makeStage()

        const hint = startDragHint(ticker, stage, makeCard())

        expect(ticker.callbacks).toEqual([hint.tick])
        stage.handlers.get('pointerdown')!()
        expect(ticker.callbacks).toEqual([])
        expect(stage.handlers.has('pointerdown')).toBe(false)
    })
})

describe('tickDragHint', () => {
    it('shifts and raises the card while it is slid out of the pile', () => {
        const card = makeCard()
        const hint = startDragHint(makeTicker(HINT_DELAY_MS + HINT_NUDGE_MS * 0.45), makeStage(), card)

        tickDragHint(hint)

        expect(card.lift.offsetX).toBe(200 * HINT_SHIFT_X)
        expect(card.lift.offsetY).toBe(300 * HINT_SHIFT_Y)
        expect(card.lift.reasons.has('hint')).toBe(true)
    })

    it('lowers the card back once it is in place again', () => {
        const card = makeCard()
        card.lift.reasons.add('hint')
        const hint = startDragHint(makeTicker(HINT_DELAY_MS - 1), makeStage(), card)

        tickDragHint(hint)

        expect(card.lift.reasons.has('hint')).toBe(false)
    })

    it('stops itself once the nudge has played', () => {
        const ticker = makeTicker(HINT_DELAY_MS + HINT_NUDGE_MS)
        const hint = startDragHint(ticker, makeStage(), makeCard())

        tickDragHint(hint)

        expect(ticker.callbacks).toEqual([])
    })
})

describe('stopDragHint', () => {
    it('puts an interrupted card straight back in the pile without touching other lift reasons', () => {
        const card = makeCard()
        const hint = startDragHint(makeTicker(HINT_DELAY_MS + HINT_NUDGE_MS * 0.45), makeStage(), card)
        tickDragHint(hint)
        card.lift.reasons.add('drag')

        stopDragHint(hint)

        expect(card.lift.offsetX).toBe(0)
        expect(card.lift.offsetY).toBe(0)
        expect([...card.lift.reasons]).toEqual(['drag'])
    })
})
