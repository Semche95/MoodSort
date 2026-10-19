import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { findFollowedStack, sortTopFirst, StackSpread } from '../features/stack/stack-spread/stack-spread'
import { computeSpreadCellBox, computeStackSpreadLayout, SPREAD_GAP } from '../features/stack/stack-spread/stack-spread-layout'
import { createCardLift } from '../features/card/card-lift'
import { I18n } from '../i18n/I18n'
import { Card } from '../types/card.types'
import { StackSpreadDeps } from '../types/stack-spread-deps.types'
import { StackSpreadItem } from '../types/stack-spread-item.types'
import { MockContainer, MockText } from './spread-pixi-mock'

vi.mock('pixi.js', async () => (await import('./spread-pixi-mock')).spreadPixiMock)

const SCREEN = { width: 1920, height: 1080 }
const CARD_WIDTH = 192
const CARD_HEIGHT = 286
const CARD_RATIO = 382 / 256

function makeCard(imageUrl: string, x: number, y: number): Card {
    const card = new MockContainer() as unknown as Card & MockContainer
    Object.assign(card, {
        imageUrl,
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        innerSprite: { texture: { width: 256, height: 382 } },
        lift: createCardLift(),
    })
    card.scale.set(0.75)
    return card
}

function makeEvent(x: number, y: number, buttons: number = 1): FederatedPointerEvent {
    return { global: { x, y }, buttons, stopPropagation: vi.fn() } as unknown as FederatedPointerEvent
}

interface Setup {
    spread: StackSpread
    stage: MockContainer
    cardLayer: MockContainer
    deps: StackSpreadDeps & { onCardGrab: ReturnType<typeof vi.fn> }
    dragging: { value: boolean }
    names: Record<string, string>
    tick: () => void
}

function setup(cards: Card[]): Setup {
    const stage = new MockContainer()
    const cardLayer = new MockContainer()
    for (const card of cards) {
        cardLayer.addChild(card as unknown as MockContainer)
    }
    const ticks: Array<() => void> = []
    const app = { stage, screen: SCREEN, ticker: { add: (fn: () => void): void => { ticks.push(fn) } } } as unknown as Application
    const dragging = { value: false }
    const names: Record<string, string> = {}
    const deps = {
        getStackNames: (): Record<string, string> => names,
        getResolvedTheme: (): 'light' => 'light',
        isDragging: (): boolean => dragging.value,
        onCardGrab: vi.fn(),
    }
    const spread = new StackSpread(app, cardLayer as unknown as Container, deps)
    spread.addToStage()
    return { spread, stage, cardLayer, deps, dragging, names, tick: (): void => ticks.forEach((fn: () => void): void => fn()) }
}

function part(spread: StackSpread, name: 'veil' | 'grid' | 'scrollbar' | 'pill' | 'closeButton'): MockContainer {
    return spread[name] as unknown as MockContainer
}

function shownCards(spread: StackSpread): string[] {
    return spread['items']
        .filter((item: StackSpreadItem): boolean => item.view.visible && item.card !== null)
        .map((item: StackSpreadItem): string => item.card!.imageUrl)
}

function pillLabel(spread: StackSpread): string {
    const labels = spread.view.children[4] as unknown as MockContainer
    return (labels.children.find((child: MockContainer): boolean => child.visible) as MockText).text
}

function pile(count: number, prefix: string = 'c'): Card[] {
    return Array.from({ length: count }, (_: unknown, i: number): Card => makeCard(`${prefix}${i}`, 500 + i * 5, 300 + i * 5))
}

beforeEach(() => {
    I18n.setLocale('en')
})

describe('sortTopFirst', () => {
    it('orders a stack from its top card down', () => {
        const [a, b, c] = pile(3)
        const { cardLayer } = setup([a, b, c])

        expect(sortTopFirst([b, a, c], cardLayer as unknown as Container)).toEqual([c, b, a])
    })
})

describe('findFollowedStack', () => {
    it('picks the stack holding most of the shown cards', () => {
        const [a, b, c, d] = pile(4)
        const { cardLayer } = setup([a, b, c, d])

        expect(findFollowedStack([a, b, c], [[a], [b, c, d]], cardLayer as unknown as Container)).toEqual([b, c, d])
    })

    it('returns no stack once none of the shown cards is left', () => {
        const [a, b] = pile(2)
        const { cardLayer } = setup([a, b])

        expect(findFollowedStack([a], [[b]], cardLayer as unknown as Container)).toEqual([])
    })
})

describe('StackSpread', () => {
    it('stays closed, and out of the pointer\'s way, until opened', () => {
        const { spread, tick } = setup(pile(3))
        tick()

        expect(spread.isOpen).toBe(false)
        expect(spread.view.visible).toBe(false)
        expect(spread.view.eventMode).toBe('none')
    })

    it('ignores a lone card', () => {
        const [a] = pile(1)
        const { spread } = setup([a])

        spread.open([a])

        expect(spread.isOpen).toBe(false)
    })

    it('opens above the board with every card top first, under a pill counting them', () => {
        const cards = pile(5)
        const { spread, stage } = setup(cards)

        spread.open(cards)

        expect(stage.children[stage.children.length - 1]).toBe(spread.view)
        expect(spread.view.visible).toBe(true)
        expect(part(spread, 'veil').visible).toBe(true)
        expect(shownCards(spread)).toEqual(['c4', 'c3', 'c2', 'c1', 'c0'])
        expect(pillLabel(spread)).toBe(I18n.t('stack.spreadCardCount', { count: 5 }))
    })

    it('puts the stack name before the count', () => {
        const cards = pile(3)
        const { spread, names } = setup(cards)
        names.c0 = 'Morning'

        spread.open(cards)

        expect(pillLabel(spread)).toBe(`Morning · ${I18n.t('stack.spreadCardCount', { count: 3 })}`)
    })

    it('closes on Escape only', () => {
        const cards = pile(3)
        const { spread } = setup(cards)
        spread.open(cards)

        spread.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }))
        expect(spread.isOpen).toBe(true)
        spread.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))

        expect(spread.isOpen).toBe(false)
        expect(spread.view.visible).toBe(false)
    })

    it('closes on a press in empty space or on the close button, without letting it reach the board', () => {
        for (const target of ['veil', 'closeButton'] as const) {
            const cards = pile(3)
            const { spread } = setup(cards)
            spread.open(cards)
            const event = makeEvent(5, 5)

            part(spread, target).emit('pointerdown', event)

            expect(spread.isOpen).toBe(false)
            expect(event.stopPropagation).toHaveBeenCalled()
        }
    })

    it('hands a pressed card over to a board drag once the pointer moves, grabbed at the same spot scaled to board size', () => {
        const cards = pile(3)
        const { spread, stage, deps } = setup(cards)
        spread.open(cards)
        const item = spread['items'][0]
        const scale = item.view.scale.x
        const press = makeEvent(item.view.x + 64 * scale, item.view.y + 191 * scale)

        item.view.emit('pointerdown', press)
        expect(deps.onCardGrab).not.toHaveBeenCalled()
        const move = makeEvent(press.global.x + 3, press.global.y)
        stage.emit('pointermove', move)

        expect(press.stopPropagation).toHaveBeenCalled()
        expect(deps.onCardGrab).toHaveBeenCalledWith(cards[2], move, { x: -CARD_WIDTH / 4, y: -CARD_HEIGHT / 2 })
    })

    it('leaves the board untouched on a click that never moves', () => {
        const cards = pile(3)
        const { spread, stage, deps } = setup(cards)
        spread.open(cards)
        const item = spread['items'][0]

        item.view.emit('pointerdown', makeEvent(item.view.x + 5, item.view.y + 5))
        stage.emit('pointerup', {})
        stage.emit('pointermove', makeEvent(item.view.x + 50, item.view.y + 5))

        expect(deps.onCardGrab).not.toHaveBeenCalled()
    })

    it('steps aside during a drag, keeping only its pill, then comes back for the drop', () => {
        const cards = pile(3)
        const { spread, dragging, tick } = setup(cards)
        spread.open(cards)

        dragging.value = true
        tick()
        for (const name of ['veil', 'grid', 'scrollbar'] as const) {
            expect(part(spread, name).visible).toBe(false)
            expect(part(spread, name).eventMode).toBe('none')
        }
        expect(part(spread, 'pill').visible).toBe(true)

        dragging.value = false
        tick()
        expect(part(spread, 'veil').visible).toBe(true)
        expect(part(spread, 'veil').eventMode).toBe('static')
    })

    it('keeps following the pile as cards leave it, and closes once a lone card is left', () => {
        const cards = pile(3)
        const { spread, tick } = setup(cards)
        spread.open(cards)

        cards[2].x = 1500
        tick()
        expect(shownCards(spread)).toEqual(['c1', 'c0'])
        expect(pillLabel(spread)).toBe(I18n.t('stack.spreadCardCount', { count: 2 }))

        cards[1].x = 100
        tick()
        expect(spread.isOpen).toBe(false)
    })

    it('does not reshuffle the grid while a card is still being dragged', () => {
        const cards = pile(3)
        const { spread, dragging, tick } = setup(cards)
        spread.open(cards)

        dragging.value = true
        cards[2].x = 1500
        tick()

        expect(spread['cards']).toHaveLength(3)
    })

    describe('scrolling the whole deck', () => {
        function openDeck(): Setup & { cards: Card[] } {
            const cards = Array.from({ length: 85 }, (_: unknown, i: number): Card => makeCard(`d${i}`, 800 + (i % 5), 400 + (i % 7)))
            const context = setup(cards)
            context.spread.open(cards)
            return { ...context, cards }
        }

        it('scrolls one row per wheel notch, never past the last row', () => {
            const { spread, stage, tick } = openDeck()
            const firstShown = (): string => shownCards(spread)[0]
            const top = firstShown()

            stage.emit('wheel', { deltaY: 100, deltaMode: 0 })
            tick()
            expect(firstShown()).toBe(spread['cards'][12].imageUrl)
            for (let i = 0; i < 10; i++) {
                stage.emit('wheel', { deltaY: 100, deltaMode: 0 })
            }
            tick()
            expect(spread['row']).toBe(4)
            stage.emit('wheel', { deltaY: -3, deltaMode: 1 })
            tick()
            expect(spread['row']).toBe(3)
            expect(top).toBe(spread['cards'][0].imageUrl)
        })

        it('jumps to the rows under a press on the scrollbar, and follows a drag along it', () => {
            const { spread, stage, tick } = openDeck()
            const scrollbar = part(spread, 'scrollbar')

            scrollbar.emit('pointerdown', makeEvent(1915, SCREEN.height - 20))
            tick()
            expect(spread['row']).toBe(4)
            stage.emit('pointermove', makeEvent(1915, 120))
            tick()
            expect(spread['row']).toBe(0)
        })

        it('moves the hover outline to whatever card scrolls under a still pointer', () => {
            const { spread, stage, tick } = openDeck()
            const layout = computeStackSpreadLayout(85, SCREEN, CARD_WIDTH, CARD_RATIO)
            const cell = computeSpreadCellBox(layout, 0)
            const outlined = (): string | undefined => spread['items'].find((item: StackSpreadItem): boolean => item.highlight.visible)?.card?.imageUrl

            stage.emit('pointermove', makeEvent(cell.x + 10, cell.y + 10))
            tick()
            expect(outlined()).toBe(spread['cards'][0].imageUrl)
            stage.emit('wheel', { deltaY: 100, deltaMode: 0 })
            tick()
            expect(outlined()).toBe(spread['cards'][12].imageUrl)
            stage.emit('pointermove', makeEvent(cell.x + cell.width + SPREAD_GAP / 2, cell.y + 10))
            tick()
            expect(outlined()).toBeUndefined()
        })

        it('ignores the wheel while closed', () => {
            const { spread, stage } = openDeck()
            spread.close()

            stage.emit('wheel', { deltaY: 100, deltaMode: 0 })

            expect(spread['row']).toBe(0)
        })
    })
})
