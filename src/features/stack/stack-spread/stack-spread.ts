import { Application, Container, FederatedPointerEvent, FederatedWheelEvent, Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { ViewportSize } from '../../../types/viewport-size.types'
import { StackSpreadDeps } from '../../../types/stack-spread-deps.types'
import { StackSpreadGrab } from '../../../types/stack-spread-grab.types'
import { StackSpreadItem } from '../../../types/stack-spread-item.types'
import { StackSpreadLayout } from '../../../types/stack-spread-layout.types'
import { computeStacks, listLayerCards } from '../stack'
import { computeCardLayoutKey } from '../stack-geometry'
import { computeStackLabel, pickWinningGroup } from '../stack-naming'
import { StackLabelPool } from '../stack-overlay/stack-label-pool'
import { getPixiThemeColors } from '../../theme/pixi-theme-colors'
import { I18n } from '../../../i18n/I18n'
import {
    clampSpreadRow,
    computeSpreadCellBox,
    computeSpreadPillLayout,
    computeSpreadRowAtScrollbarY,
    computeSpreadScrollbar,
    computeStackSpreadLayout,
    findSpreadSlotAt,
} from './stack-spread-layout'
import { createSpreadItem, drawSpreadItem, drawSpreadPill, drawSpreadScrollbar, drawSpreadVeil } from './stack-spread-view'

/** Wheel travel that scrolls one row: a mouse notch is about 100px, a trackpad sends many small deltas. */
const WHEEL_ROW_DELTA = 50
/** Pixel height of a wheel "line" (`deltaMode` 1, Firefox's default for mice) */
const WHEEL_LINE_HEIGHT = 40
const LABEL_MAX_WIDTH = 240
const LABEL_SEPARATOR = ' · '

/** `stack` ordered as it reads from the top of the pile down. */
export function sortTopFirst(stack: Card[], cardLayer: Container): Card[] {
    return [...stack].sort((a: Card, b: Card): number => cardLayer.children.indexOf(b) - cardLayer.children.indexOf(a))
}

/**
 * The stack now holding most of `shown`, so the spread keeps following its pile whatever moved cards (a card dragged
 * out of it, undo, redo, resize); ties go to the group a split name would follow.
 */
export function findFollowedStack(shown: Card[], stacks: Card[][], cardLayer: Container): Card[] {
    const shownCards = new Set<Card>(shown)
    const counts = stacks.map((stack: Card[]): number => stack.filter((card: Card): boolean => shownCards.has(card)).length)
    const best = Math.max(0, ...counts)
    if (best === 0) {
        return []
    }
    return pickWinningGroup(stacks.filter((_: Card[], index: number): boolean => counts[index] === best), cardLayer)
}

/**
 * Lays every card of one stack out in a grid on a layer above the whole board, so a stack of any size can be read
 * card by card, by the host and share viewers alike. The layer only shows copies: pressing one and moving starts a
 * regular drag of the board card itself, during which the layer steps aside until the drop.
 */
export class StackSpread {
    readonly view: Container
    private app: Application
    private cardLayer: Container
    private deps: StackSpreadDeps
    private veil: Graphics
    private grid: Container
    private scrollbar: Graphics
    private pill: Graphics
    private closeButton: Graphics
    private labelPool: StackLabelPool
    private items: StackSpreadItem[]
    private cards: Card[]
    private layout: StackSpreadLayout | null
    private row: number
    private pointer: Position | null
    private closeHovered: boolean
    private grab: StackSpreadGrab | null
    private scrolling: boolean
    private wheelDelta: number
    private layoutKey: string
    private renderKey: string

    constructor(app: Application, cardLayer: Container, deps: StackSpreadDeps) {
        this.app = app
        this.cardLayer = cardLayer
        this.deps = deps
        this.view = new Container()
        this.view.label = 'stack-spread'
        this.view.visible = false
        this.view.eventMode = 'none'
        this.veil = new Graphics()
        this.veil.eventMode = 'static'
        this.veil.on('pointerdown', this.handleVeilPointerDown)
        this.grid = new Container()
        this.scrollbar = new Graphics()
        this.scrollbar.eventMode = 'static'
        this.scrollbar.on('pointerdown', this.handleScrollbarPointerDown)
        this.pill = new Graphics()
        // The pill stays put above a drag in progress: a press on it must not reach the veil-less board below.
        this.pill.eventMode = 'static'
        this.pill.on('pointerdown', (e: FederatedPointerEvent): void => e.stopPropagation())
        this.closeButton = new Graphics()
        this.closeButton.eventMode = 'static'
        this.closeButton.cursor = 'pointer'
        this.closeButton.on('pointerdown', this.handleClosePointerDown)
        this.closeButton.on('pointerover', (): void => { this.closeHovered = true })
        this.closeButton.on('pointerout', (): void => { this.closeHovered = false })
        const labelContainer = new Container()
        labelContainer.eventMode = 'none'
        this.labelPool = new StackLabelPool(labelContainer)
        this.view.addChild(this.veil)
        this.view.addChild(this.grid)
        this.view.addChild(this.scrollbar)
        this.view.addChild(this.pill)
        this.view.addChild(labelContainer)
        this.view.addChild(this.closeButton)
        this.items = []
        this.cards = []
        this.layout = null
        this.row = 0
        this.pointer = null
        this.closeHovered = false
        this.grab = null
        this.scrolling = false
        this.wheelDelta = 0
        this.layoutKey = ''
        this.renderKey = ''
    }

    get isOpen(): boolean {
        return this.cards.length > 0
    }

    /** Above every card and its overlays; whatever is added to the stage later (the toolbar) stays above the spread. */
    addToStage(): void {
        this.app.stage.addChild(this.view)
        this.app.stage.on('pointermove', this.handleStagePointerMove)
        this.app.stage.on('pointerleave', this.handleStagePointerLeave)
        this.app.stage.on('pointerup', this.handleStagePointerUp)
        this.app.stage.on('pointerupoutside', this.handleStagePointerUp)
        this.app.stage.on('wheel', this.handleWheel)
        this.app.ticker.add(this.render)
    }

    open(stack: Card[]): void {
        if (stack.length < 2) {
            return
        }
        this.cards = sortTopFirst(stack, this.cardLayer)
        this.row = 0
        this.layoutKey = computeCardLayoutKey(listLayerCards(this.cardLayer))
        this.render()
    }

    close(): void {
        this.cards = []
        this.grab = null
        this.scrolling = false
        this.closeHovered = false
        this.renderKey = ''
        this.view.visible = false
        // Hidden objects are still hit-tested: a closed spread would otherwise cover the whole board.
        this.view.eventMode = 'none'
    }

    handleKeyDown: (e: KeyboardEvent) => void = (e: KeyboardEvent): void => {
        if (this.isOpen && e.key === 'Escape') {
            this.close()
        }
    }

    private get viewport(): ViewportSize {
        return { width: this.app.screen.width, height: this.app.screen.height }
    }

    private render: () => void = (): void => {
        if (!this.isOpen) {
            return
        }
        const dragging = this.deps.isDragging()
        // A dragged card's stack is only settled at the drop; following it mid-drag would reshuffle the grid under the pointer.
        if (!dragging) {
            this.followStack()
            if (!this.isOpen) {
                return
            }
        }
        const top = this.cards[0]
        const { width, height } = top.innerSprite.texture
        this.layout = computeStackSpreadLayout(this.cards.length, this.viewport, top.width, height / width)
        this.row = clampSpreadRow(this.layout, this.row)
        const hoveredCard = this.findHoveredCard(this.layout, dragging)
        const renderKey = [
            this.deps.getResolvedTheme(),
            JSON.stringify(this.deps.getStackNames()),
            this.cards.map((card: Card): string => card.imageUrl).join(','),
            this.viewport.width,
            this.viewport.height,
            top.width,
            this.row,
            hoveredCard?.imageUrl ?? '',
            this.closeHovered,
            dragging,
        ].join('#')
        if (renderKey !== this.renderKey) {
            this.renderKey = renderKey
            this.draw(this.layout, dragging, hoveredCard)
        }
        // Textures swap a moment after a theme change, once the matching atlas has loaded.
        for (const item of this.items) {
            if (item.card) {
                item.sprite.texture = item.card.innerSprite.texture
            }
        }
    }

    /** Narrows or widens the shown cards to the stack that now holds most of them; closes once it is down to a lone card. */
    private followStack(): void {
        const layerCards = listLayerCards(this.cardLayer)
        const layoutKey = computeCardLayoutKey(layerCards)
        if (layoutKey === this.layoutKey) {
            return
        }
        this.layoutKey = layoutKey
        const stack = findFollowedStack(this.cards, computeStacks(layerCards), this.cardLayer)
        if (stack.length < 2) {
            this.close()
            return
        }
        this.cards = sortTopFirst(stack, this.cardLayer)
    }

    /** The card under the last known pointer, read each frame so it follows the grid as it scrolls under a still pointer. */
    private findHoveredCard(layout: StackSpreadLayout, dragging: boolean): Card | null {
        if (!this.pointer || dragging || this.closeHovered) {
            return null
        }
        const first = this.row * layout.columns
        const slot = findSpreadSlotAt(layout, this.pointer, this.cards.length - first)
        return slot === null ? null : this.cards[first + slot]
    }

    private draw(layout: StackSpreadLayout, dragging: boolean, hoveredCard: Card | null): void {
        const palette = getPixiThemeColors(this.deps.getResolvedTheme())
        const viewport = this.viewport
        this.view.visible = true
        this.view.eventMode = 'passive'
        // Pixi still hit-tests hidden objects: during a drag they must stop taking the pointer, or the board below reads as covered.
        this.veil.visible = !dragging
        this.veil.eventMode = dragging ? 'none' : 'static'
        this.grid.visible = !dragging
        this.grid.eventMode = dragging ? 'none' : 'passive'
        this.scrollbar.visible = !dragging
        this.scrollbar.eventMode = dragging ? 'none' : 'static'
        drawSpreadVeil(this.veil, viewport, palette)

        const first = this.row * layout.columns
        const shown = this.cards.slice(first, first + layout.columns * layout.visibleRows)
        while (this.items.length < shown.length) {
            this.items.push(this.createItem())
        }
        this.items.forEach((item: StackSpreadItem, slot: number): void => {
            const card = shown[slot] ?? null
            item.card = card
            if (!card) {
                item.view.visible = false
                return
            }
            drawSpreadItem(item, computeSpreadCellBox(layout, slot), card.innerSprite.texture, card === hoveredCard, palette.card)
        })
        drawSpreadScrollbar(this.scrollbar, computeSpreadScrollbar(layout, this.row, viewport), palette.stackOverlay)

        const name = computeStackLabel(this.cards, this.cardLayer, this.deps.getStackNames())
        const count = I18n.t('stack.spreadCardCount', { count: this.cards.length })
        this.labelPool.begin()
        const label = this.labelPool.take(name ? `${name}${LABEL_SEPARATOR}${count}` : count, LABEL_MAX_WIDTH, palette.stackOverlay)
        this.labelPool.end()
        const pillLayout = computeSpreadPillLayout(label.text.width, layout, viewport)
        label.text.position.set(pillLayout.label.x, pillLayout.label.y)
        drawSpreadPill(this.pill, this.closeButton, pillLayout, this.closeHovered, palette.stackOverlay)
    }

    private createItem(): StackSpreadItem {
        const item = createSpreadItem()
        item.view.on('pointerdown', (e: FederatedPointerEvent): void => this.handleItemPointerDown(item, e))
        this.grid.addChild(item.view)
        return item
    }

    /** The card is only pulled out once the pointer moves, so a mere click changes nothing on the board. */
    private handleItemPointerDown(item: StackSpreadItem, e: FederatedPointerEvent): void {
        e.stopPropagation()
        if (!item.card) {
            return
        }
        const scale = item.view.scale.x
        const local = { x: (e.global.x - item.view.x) / scale, y: (e.global.y - item.view.y) / scale }
        const { width, height } = item.card.innerSprite.texture
        this.grab = {
            card: item.card,
            grabOffset: { x: -(local.x / width) * item.card.width, y: -(local.y / height) * item.card.height },
        }
    }

    private handleStagePointerMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        this.pointer = { x: e.global.x, y: e.global.y }
        if (this.scrolling && this.layout) {
            this.row = computeSpreadRowAtScrollbarY(this.layout, e.global.y, this.viewport)
            return
        }
        const grab = this.grab
        if (!grab) {
            return
        }
        this.grab = null
        if (e.buttons === 0 || !this.isOpen) {
            return
        }
        this.deps.onCardGrab(grab.card, e, grab.grabOffset)
    }

    private handleStagePointerLeave: () => void = (): void => {
        this.pointer = null
    }

    private handleStagePointerUp: () => void = (): void => {
        this.grab = null
        this.scrolling = false
    }

    private handleVeilPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        e.stopPropagation()
        this.close()
    }

    private handleClosePointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        e.stopPropagation()
        this.close()
    }

    private handleScrollbarPointerDown: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        e.stopPropagation()
        if (!this.layout) {
            return
        }
        this.scrolling = true
        this.row = computeSpreadRowAtScrollbarY(this.layout, e.global.y, this.viewport)
    }

    private handleWheel: (e: FederatedWheelEvent) => void = (e: FederatedWheelEvent): void => {
        if (!this.isOpen || !this.layout || this.deps.isDragging()) {
            return
        }
        this.wheelDelta += e.deltaMode === 1 ? e.deltaY * WHEEL_LINE_HEIGHT : e.deltaY
        if (Math.abs(this.wheelDelta) < WHEEL_ROW_DELTA) {
            return
        }
        this.row = clampSpreadRow(this.layout, this.row + Math.sign(this.wheelDelta))
        this.wheelDelta = 0
    }
}
