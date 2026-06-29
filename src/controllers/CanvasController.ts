import { Application, Bounds, Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import { Card } from '../types/card.types'
import { Deck } from '../models/Deck'
import { DeckController } from './DeckController'
import { CardDragState, DeckDragState } from '../types/drag.types'
import { Dimensions } from '../types/position.types'
import {
    BORDER_WIDTH,
    CORNER_RADIUS,
    DECK_BACKGROUND_COLOR,
    DECK_MARGIN,
    DEFAULT_OPACITY,
    TITLE_BAR_COLOR,
} from '../utils/constants'
import { addCard } from '../utils/card'
import {
    onCardDragEnd,
    onCardDragMove,
    onCardDragStart,
    onDeckDragEnd,
    onDeckDragMove,
    onDeckDragStart,
    relocateCardAtGlobalPosition,
} from '../utils/drag'
import { loadState, SavedState, saveState } from '../utils/storage'
import { DeckViewerDropDetail, DeckViewerHoverDetail } from '../types/viewer.types'

/**
 * CanvasController encapsulates the PixiJS app state and wiring
 */
export class CanvasController {
    app: Application
    decks: Deck[]
    cardDragState: CardDragState
    deckDragState: DeckDragState
    cardDimensions: Dimensions
    deckDimensions: Dimensions
    private _lastTitleBarClickTime: number = 0
    private _lastTitleBarClickDeck: Deck | null = null

    // Helpers to reduce duplication
    private toStageCoords(clientX: number, clientY: number): { x: number, y: number } {
        const rect: DOMRect = this.app.canvas.getBoundingClientRect()
        const scaleX: number = this.app.screen.width / rect.width
        const scaleY: number = this.app.screen.height / rect.height
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
    }

    private unhighlightAllDecks(): void {
        DeckController.unhighlightAll(this.decks, this.deckDimensions.width, this.deckDimensions.height, this.handleTitleBarClick)
    }

    private findDeckIntersectingRect(rect: { x: number, y: number, width: number, height: number }): Deck | null {
        for (const deck of this.decks) {
            const bg: Graphics = deck.getChildAt(0) as Graphics
            const b: Bounds = bg.getBounds()
            const intersects: boolean = rect.x + rect.width > b.x && rect.x < b.x + b.width && rect.y + rect.height > b.y && rect.y < b.y + b.height
            if (intersects) {
                return deck
            }
        }
        return null
    }

    constructor() {
        this.app = new Application()
        this.decks = []
        this.cardDragState = {
            dragTarget: null,
            dragOffset: { x: 0, y: 0 },
            originalParent: null,
            originalPosition: { x: 0, y: 0 },
            cardMoved: false,
        }
        this.deckDragState = {
            dragDeckTarget: null,
            dragDeckOffset: { x: 0, y: 0 },
        }
        this.cardDimensions = { width: 0, height: 0 }
        this.deckDimensions = DeckController.calculateDimensions(0, 0)
        // viewer-related fields removed per requirement
    }

    async init(images: string[]): Promise<void> {
        if (images.length === 0) {
            throw new Error('No images found')
        }

        await this.app.init({
            antialias: true,
            backgroundColor: '#a9a9a9',
            resizeTo: window,
        })

        const initialDeck: Deck = this.createDeck()
        initialDeck.x = DECK_MARGIN
        initialDeck.y = DECK_MARGIN
        this.decks.push(initialDeck)

        const saved: SavedState | null = loadState()
        if (this.hasSavedDecks(saved)) {
            await this.restoreFromSavedState(saved as SavedState, images, initialDeck)
        } else {
            await this.populateInitialDeck(images, initialDeck)
        }

        this.wireStageHandlers()
        this.wireViewerBridge()
        document.body.appendChild(this.app.canvas)
    }

    // Handlers as arrow properties to preserve "this" when passing as callbacks
    handleCardDragMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent) => {
        // Defensive: if no button is pressed but we still have a drag target, end the drag
        if (e.buttons === 0 && this.cardDragState.dragTarget) {
            this.handleCardDragEnd()
            return
        }
        onCardDragMove(
            e,
            this.cardDragState,
            this.decks,
            this.app.screen.width,
            this.app.screen.height,
            this.deckDimensions.width,
            this.deckDimensions.height,
            this.handleTitleBarClick,
        )
    }

    handleDeckDragMove: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent) => {
        onDeckDragMove(e, this.deckDragState, this.app.stage, this.app.screen.width, this.app.screen.height)
    }

    handleDeckDragEnd: () => void = () => {
        onDeckDragEnd(this.deckDragState, this.app.stage, this.handleDeckDragMove, this.handleEmptyCallback)
        saveState(this.decks)
    }

    handleEmptyCallback: () => void = () => {
        // No action needed
    }

    private renameDeckFromEvent(event: FederatedPointerEvent): void {
        const hitArea: Container = event.currentTarget as Container
        const deck: Deck = hitArea.parent?.parent as Deck
        if (!deck) {
            return
        }
        // Cancel any active deck drag so the deck stays in place
        this.deckDragState.dragDeckTarget = null
        if (typeof this.app.stage.off === 'function') {
            this.app.stage.off('pointermove', this.handleDeckDragMove)
            this.app.stage.off('pointerup', this.handleDeckDragEnd)
            this.app.stage.off('pointerupoutside', this.handleDeckDragEnd)
        }
        const newName: string | null = window.prompt('Nom du tas (laissez vide pour effacer) :', deck.name || '')
        if (newName === null) {
            return
        }
        deck.name = newName || ''
        deck.updateBorder(false, this.deckDimensions.width, this.deckDimensions.height, this.handleTitleBarClick)
    }

    handleTitleBarClick: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
        event.stopPropagation()
        const now: number = Date.now()
        const hitArea: Container = event.currentTarget as Container
        const deck: Deck = hitArea.parent?.parent as Deck
        if (deck && this._lastTitleBarClickDeck === deck && now - this._lastTitleBarClickTime < 400) {
            this._lastTitleBarClickTime = 0
            this._lastTitleBarClickDeck = null
            this.renameDeckFromEvent(event)
            return
        }
        this._lastTitleBarClickTime = now
        this._lastTitleBarClickDeck = deck
        onDeckDragStart(event, this.deckDragState, this.app.stage, this.handleDeckDragMove, this.handleDeckDragEnd)
    }

    handleCardDragStart: (event: FederatedPointerEvent) => void = (event: FederatedPointerEvent) => {
        onCardDragStart(event, this.cardDragState, this.decks, this.app.stage, this.handleCardDragMove, this.deckDimensions.width, this.deckDimensions.height, this.handleTitleBarClick)
    }

    handleCardDragEnd: () => void = () => {
        onCardDragEnd(
            this.cardDragState,
            this.decks,
            this.app.stage,
            this.handleCardDragMove,
            this.createDeck,
            this.deckDimensions.width,
            this.deckDimensions.height,
            this.app.screen.width,
            this.app.screen.height,
            this.handleTitleBarClick,
        )
        saveState(this.decks)
    }

    createDeck: () => Deck = () => {
        const deck: Deck = new Deck()
        const deckBackground: Graphics = new Graphics()
        deck.setBackground(deckBackground)
        deck.redrawBackground(
            this.deckDimensions.width,
            this.deckDimensions.height,
            TITLE_BAR_COLOR,
            DECK_BACKGROUND_COLOR,
            CORNER_RADIUS,
            BORDER_WIDTH,
            this.handleTitleBarClick,
        )
        deck.setBackground(deckBackground)
        this.app.stage.addChild(deck)
        return deck
    }

    adjustDeckSizes: (initialDeck: Deck) => void = (initialDeck: Deck) => {
        this.deckDimensions = DeckController.calculateDimensions(this.cardDimensions.width, this.cardDimensions.height)
        initialDeck.redrawBackground(
            this.deckDimensions.width,
            this.deckDimensions.height,
            TITLE_BAR_COLOR,
            DECK_BACKGROUND_COLOR,
            CORNER_RADIUS,
            BORDER_WIDTH,
            this.handleTitleBarClick,
        )
        initialDeck.x = DECK_MARGIN
        initialDeck.y = DECK_MARGIN
    }

    private hasSavedDecks(saved: SavedState | null): boolean {
        return !!saved && Array.isArray(saved.decks) && saved.decks.length > 0
    }

    private async restoreFromSavedState(saved: SavedState, images: string[], initialDeck: Deck): Promise<void> {
        const available: Set<string> = new Set(images)
        let firstDeck: boolean = true
        for (const savedDeck of saved.decks) {
            const deck: Deck = firstDeck ? initialDeck : this.createDeck()
            if (firstDeck) {
                firstDeck = false
            } else {
                this.decks.push(deck)
            }
            deck.x = savedDeck.x
            deck.y = savedDeck.y
            deck.name = savedDeck.name ?? ''
            for (const img of savedDeck.cards) {
                if (!available.has(img)) {
                    continue
                }
                const dimensions: Dimensions = await addCard(
                    img,
                    deck,
                    this.handleCardDragStart,
                    this.deckDimensions.width,
                    this.deckDimensions.height,
                    this.decks,
                    this.handleTitleBarClick,
                )
                this.applyInitialDimensionsIfUnset(dimensions, initialDeck, true)
            }
        }
        if (saved.decks.length > 0) {
            initialDeck.x = saved.decks[0].x
            initialDeck.y = saved.decks[0].y
        }
        saveState(this.decks)
    }

    private async populateInitialDeck(images: string[], initialDeck: Deck): Promise<void> {
        for (const image of images) {
            const dimensions: Dimensions = await addCard(
                image,
                initialDeck,
                this.handleCardDragStart,
                this.deckDimensions.width,
                this.deckDimensions.height,
                this.decks,
                this.handleTitleBarClick,
            )
            this.applyInitialDimensionsIfUnset(dimensions, initialDeck, false)
        }
        saveState(this.decks)
    }

    private applyInitialDimensionsIfUnset(dimensions: Dimensions, initialDeck: Deck, centerAllDecks: boolean): void {
        if (this.cardDimensions.width !== 0 && this.cardDimensions.height !== 0) {
            return
        }
        this.cardDimensions.width = dimensions.width
        this.cardDimensions.height = dimensions.height
        this.adjustDeckSizes(initialDeck)
        if (centerAllDecks) {
            this.centerAllDeckCards()
        } else {
            this.centerDeckCards(initialDeck)
        }
    }

    private centerDeckCards(deck: Deck): void {
        for (let i: number = 1; i < deck.children.length; i++) {
            const card: Card = deck.children[i] as Card
            deck.centerCard(card, this.deckDimensions.width, this.deckDimensions.height)
        }
    }

    private centerAllDeckCards(): void {
        for (const d of this.decks) {
            this.centerDeckCards(d)
        }
    }

    wireStageHandlers(): void {
        this.app.stage.eventMode = 'static'
        this.app.stage.hitArea = this.app.screen
        this.app.stage.on('pointerup', this.handleCardDragEnd)
        this.app.stage.on('pointerupoutside', this.handleCardDragEnd)
    }

    private cancelActiveCardDrag(): void {
        const target: Card | null = this.cardDragState.dragTarget as Card | null
        if (!target) {
            return
        }
        if (typeof this.app.stage.off === 'function') {
            this.app.stage.off('pointermove', this.handleCardDragMove)
        }
        target.alpha = DEFAULT_OPACITY
        const originalParent: Container | null = this.cardDragState.originalParent
        if (originalParent) {
            if (target.parent) {
                target.parent.removeChild(target)
            }
            originalParent.addChild(target)
            target.x = this.cardDragState.originalPosition.x
            target.y = this.cardDragState.originalPosition.y
        }
        this.unhighlightAllDecks()
        this.cardDragState.originalParent = null
        this.cardDragState.originalPosition.x = 0
        this.cardDragState.originalPosition.y = 0
        this.cardDragState.dragTarget = null
        this.cardDragState.cardMoved = false
    }

    // Global resize handler to keep the dimmer in sync with the viewport
    handleResize: () => void = () => {
        // no-op (viewer dimmer removed)
    }

    // Handlers for deck viewer bridge as arrow properties to satisfy callback guidelines
    handleViewerOpened: () => void = () => {
        // Ensure any active canvas drag is canceled before interacting with the viewer overlay
        this.cancelActiveCardDrag()
        // Disable Pixi event processing while the viewer is active to prevent any canvas pointer handling
        this.app.stage.eventMode = 'none'
        this.unhighlightAllDecks()
    }

    handleViewerHover: (evt: Event) => void = (evt: Event) => {
        // Extra safety: if a Pixi card drag was somehow left active, cancel it on first hover tick
        this.cancelActiveCardDrag()
        const e: CustomEvent<DeckViewerHoverDetail> = evt as CustomEvent<DeckViewerHoverDetail>
        const d: DeckViewerHoverDetail = e.detail
        if (!d) {
            return
        }
        const stage: { x: number; y: number } = this.toStageCoords(d.x, d.y)
        const halfW: number = d.width / 2
        const halfH: number = d.height / 2
        const rect: { x: number; y: number; width: number; height: number } = { x: stage.x - halfW, y: stage.y - halfH, width: d.width, height: d.height }
        this.unhighlightAllDecks()
        const hoveredDeck: Deck | null = this.findDeckIntersectingRect(rect)
        if (hoveredDeck) {
            hoveredDeck.updateBorder(true, this.deckDimensions.width, this.deckDimensions.height, this.handleTitleBarClick)
        }
    }

    handleViewerEnd: () => void = () => {
        // When the viewer signals drag end, also ensure any canvas drag is canceled
        this.cancelActiveCardDrag()
        this.unhighlightAllDecks()
    }

    handleViewerClosed: () => void = () => {
        // Viewer closed: ensure any lingering canvas drag is canceled
        this.cancelActiveCardDrag()
        this.unhighlightAllDecks()
        // Re-enable Pixi event processing when viewer closes
        this.app.stage.eventMode = 'static'
    }

    handleViewerDrop: (evt: Event) => void = (evt: Event) => {
        this.unhighlightAllDecks()
        const e: CustomEvent<DeckViewerDropDetail> = evt as CustomEvent<DeckViewerDropDetail>
        const detail: DeckViewerDropDetail = e.detail
        if (!detail || !detail.card) {
            return
        }
        const stage: { x: number; y: number } = this.toStageCoords(detail.x, detail.y)

        relocateCardAtGlobalPosition(
            detail.card,
            stage.x,
            stage.y,
            this.decks,
            this.app.stage,
            this.createDeck,
            this.deckDimensions.width,
            this.deckDimensions.height,
            this.app.screen.width,
            this.app.screen.height,
            this.handleTitleBarClick,
        )
        saveState(this.decks)
    }

    wireViewerBridge(): void {
        document.addEventListener('deckviewer:opened', this.handleViewerOpened)
        document.addEventListener('deckviewer:hover', this.handleViewerHover)
        document.addEventListener('deckviewer:end', this.handleViewerEnd)
        document.addEventListener('deckviewer:closed', this.handleViewerClosed)
        document.addEventListener('deckviewer:drop', this.handleViewerDrop)
        document.addEventListener('deckviewer:rename', this.handleViewerRename)
    }

    handleViewerRename: () => void = () => {
        saveState(this.decks)
    }
}
