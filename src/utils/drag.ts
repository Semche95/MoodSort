import { Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from '../types/card.types'
import { Deck } from '../models/Deck'
import { CardDragState, DeckDragState } from '../types/drag.types'
import { DEFAULT_OPACITY, DRAGGING_OPACITY, TITLE_BAR_HEIGHT } from './constants'
import { constrainPosition } from './card'
import { Position } from '../types/position.types'
import { DeckController } from '../controllers/DeckController'

/**
 * Resets the card drag state variables
 * @param dragState - The drag state to reset
 */
export function resetDragState(dragState: CardDragState): void {
    dragState.dragTarget = null
    dragState.originalParent = null
    dragState.originalPosition.x = 0
    dragState.originalPosition.y = 0
    dragState.cardMoved = false
}

/**
 * Handles the drag start event for a card
 * @param event - The pointer event
 * @param dragState - The drag state to update
 * @param decks - Array of all decks
 * @param stage - The stage to add event listeners to
 * @param onDragMove - The function to call when the card is moved
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param onTitleBarClick - The function to call when the title bar is clicked
 */
export function onCardDragStart(
    event: FederatedPointerEvent,
    dragState: CardDragState,
    decks: Deck[],
    stage: Container,
    onDragMove: (event: FederatedPointerEvent) => void,
    deckWidth: number = 0,
    deckHeight: number = 0,
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
): void {
    const target: Card = event.currentTarget as Card
    target.alpha = DRAGGING_OPACITY
    dragState.dragTarget = target
    dragState.cardMoved = false

    // Store the original parent and position
    dragState.originalParent = target.parent as Container
    dragState.originalPosition.x = target.x
    dragState.originalPosition.y = target.y

    // Get the global position of the card
    let globalPosition: Position = { x: target.x, y: target.y }
    if (typeof target.getGlobalPosition === 'function') {
        globalPosition = target.getGlobalPosition()
    }

    // Calculate the offset between the cursor position and the card's global position
    dragState.dragOffset.x = globalPosition.x - event.global.x
    dragState.dragOffset.y = globalPosition.y - event.global.y

    // Remove the card from its parent
    const parent: Container | null = target.parent
    if (parent) {
        parent.removeChild(target)
    }

    // Add the card to the stage to position it above everything else
    stage.addChild(target)

    // Set the card's position in the stage to match its original global position
    if (target.position && typeof target.position.set === 'function') {
        target.position.set(globalPosition.x, globalPosition.y)
    } else {
        // Fallback to setting x and y properties directly
        target.x = globalPosition.x
        target.y = globalPosition.y
    }

    // Unhighlight all decks first
    DeckController.unhighlightAll(decks, deckWidth, deckHeight, onTitleBarClick)

    // Highlight the deck that contains the clicked card if it's in the decks array
    if (decks.includes(dragState.originalParent as Deck)) {
        (dragState.originalParent as Deck).updateBorder(true, deckWidth, deckHeight, onTitleBarClick)
    }

    // Add the pointermove event listener to the stage
    if (typeof stage.on === 'function') {
        stage.on('pointermove', onDragMove)
    }
}

/**
 * Handles the drag move event for a card
 * @param event - The pointer event
 * @param dragState - The drag state to update
 * @param decks - Array of all decks
 * @param appWidth - The width of the application
 * @param appHeight - The height of the application
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param onTitleBarClick - The function to call when the title bar is clicked
 */
export function onCardDragMove(
    event: FederatedPointerEvent,
    dragState: CardDragState,
    decks: Deck[],
    appWidth: number,
    appHeight: number,
    deckWidth: number = 0,
    deckHeight: number = 0,
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
    activeViewerDeck: Deck | null = null,
): void {
    if (!dragState.dragTarget) {
        return
    }

    // Card has been moved
    dragState.cardMoved = true

    // Calculate new position using global coordinates
    const newGlobalX: number = event.global.x + dragState.dragOffset.x
    const newGlobalY: number = event.global.y + dragState.dragOffset.y

    // Constrain the global position to keep it within the viewport
    const constrainedGlobalPosition: Position = constrainPosition(
        newGlobalX,
        newGlobalY,
        dragState.dragTarget.width,
        dragState.dragTarget.height,
        appWidth,
        appHeight,
    )

    // Set the card's position directly using the constrained global position
    // since the card is now a direct child of the stage
    if (dragState.dragTarget.position && typeof dragState.dragTarget.position.set === 'function') {
        dragState.dragTarget.position.set(constrainedGlobalPosition.x, constrainedGlobalPosition.y)
    } else {
        // Fallback to setting x and y properties directly
        dragState.dragTarget.x = constrainedGlobalPosition.x
        dragState.dragTarget.y = constrainedGlobalPosition.y
    }

    // Check if the position has changed
    if (dragState.dragTarget.x !== constrainedGlobalPosition.x || dragState.dragTarget.y !== constrainedGlobalPosition.y) {
        dragState.cardMoved = true
    }

    // Only change deck highlighting if the card has been moved
    if (dragState.cardMoved) {
        // Check if the card is over any deck and highlight it
        const deckUnderCard: Deck | null = DeckController.getDeckUnderCard(dragState.dragTarget as Card, decks)

        // Unhighlight all decks first
        DeckController.unhighlightAll(decks, deckWidth, deckHeight, onTitleBarClick)

        if (deckUnderCard) {
            // Blue highlight on the hovered deck
            deckUnderCard.updateBorder(true, deckWidth, deckHeight, onTitleBarClick)
            // Keep orange on the active viewer deck if it is different
            if (activeViewerDeck && activeViewerDeck !== deckUnderCard) {
                activeViewerDeck.updateBorderViewer(deckWidth, deckHeight, onTitleBarClick)
            }
        } else if (activeViewerDeck) {
            // Nothing hovered: keep the active viewer deck orange
            activeViewerDeck.updateBorderViewer(deckWidth, deckHeight, onTitleBarClick)
        }
    }
}

/**
 * Adds a card to a deck and updates the deck
 * @param card - The card to add
 * @param deck - The deck to add the card to
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param onTitleBarClick - The function to call when the title bar is clicked
 */
function addCardToDeck(
    card: Card,
    deck: Deck,
    deckWidth: number,
    deckHeight: number,
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
): void {
    // Add the card to the deck
    deck.addChild(card)

    // Center the card within the deck
    deck.centerCard(card, deckWidth, deckHeight)

    // Update the deck background with the new card count
    deck.updateBorder(false, deckWidth, deckHeight, onTitleBarClick)
}

/**
 * Creates and positions a new deck for a card
 * @param card - The card to add to the new deck
 * @param createDeck - Function to create a new deck
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param appWidth - The width of the application
 * @param appHeight - The height of the application
 * @param decks - Array of all decks
 * @returns The created deck
 */
function createAndPositionNewDeck(
    card: Card,
    createDeck: () => Deck,
    deckWidth: number,
    deckHeight: number,
    appWidth: number,
    appHeight: number,
    decks: Deck[],
): Deck {
    // Create a new deck
    const newDeck: Deck = createDeck()

    // Get the global position of the card
    const cardGlobalPosition: Position = card.getGlobalPosition()

    // Calculate the initial position for the new deck using global coordinates
    const newDeckX: number = cardGlobalPosition.x - (deckWidth - card.width) / 2
    // Adjust y position to account for title bar and center the card in the content area
    const newDeckY: number = cardGlobalPosition.y - TITLE_BAR_HEIGHT - ((deckHeight - TITLE_BAR_HEIGHT - card.height) / 2)

    // Constrain the deck position to keep it within the viewport
    const constrainedPosition: Position = constrainPosition(
        newDeckX,
        newDeckY,
        deckWidth,
        deckHeight,
        appWidth,
        appHeight,
    )
    newDeck.x = constrainedPosition.x
    newDeck.y = constrainedPosition.y

    // Add the new deck to the decks array
    decks.push(newDeck)

    return newDeck
}

/**
 * Handles the drag end event for a card
 * @param dragState - The drag state to update
 * @param decks - Array of all decks
 * @param stage - The stage to remove event listeners from
 * @param onDragMove - The function to remove from event listeners
 * @param createDeck - Function to create a new deck
 * @param deckWidth - The width of the deck
 * @param deckHeight - The height of the deck
 * @param appWidth - The width of the application
 * @param appHeight - The height of the application
 * @param onTitleBarClick - The function to call when the title bar is clicked
 */
export function onCardDragEnd(
    dragState: CardDragState,
    decks: Deck[],
    stage: Container,
    onDragMove: (event: FederatedPointerEvent) => void,
    createDeck: () => Deck,
    deckWidth: number,
    deckHeight: number,
    appWidth: number,
    appHeight: number,
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
): void {
    if (!dragState.dragTarget) {
        return
    }

    // Remove the pointermove event listener from the stage
    if (typeof stage.off === 'function') {
        stage.off('pointermove', onDragMove)
    }

    dragState.dragTarget.alpha = DEFAULT_OPACITY

    // Unhighlight all decks
    DeckController.unhighlightAll(decks, deckWidth, deckHeight, onTitleBarClick)

    // Get the current card and its parent
    const card: Card = dragState.dragTarget as Card
    const currentParent: Container | null = card.parent

    // If the card wasn't moved, treat as a click: return it to its original position and open viewer
    if (!dragState.cardMoved) {
        // Remove the card from its current parent
        if (currentParent) {
            currentParent.removeChild(card)
        }

        // Add the card back to its original parent
        if (dragState.originalParent) {
            dragState.originalParent.addChild(card)
        }

        // Reset the card's position
        card.x = dragState.originalPosition.x
        card.y = dragState.originalPosition.y

        // Open deck viewer if original parent is a deck
        const parentIsDeck: boolean = (dragState.originalParent as Deck) && (dragState.originalParent as Deck).children !== undefined
        if (parentIsDeck) {
            const deck: Deck = dragState.originalParent as Deck

            // After restoring the card, redraw the deck border/count to reflect the correct number of cards
            deck.updateBorder(false, deckWidth, deckHeight, onTitleBarClick)

            // Children[0] is background; cards start from index 1
            const allChildren: Container[] = deck.children
            const cardsInDeck: Card[] = []
            for (let i: number = 1; i < allChildren.length; i++) {
                const child: Card = allChildren[i] as Card
                cardsInDeck.push(child)
            }
            // Find index of clicked card within deck cards
            let initialIndex: number = 0
            for (let i: number = 0; i < cardsInDeck.length; i++) {
                if (cardsInDeck[i] === card) {
                    initialIndex = i
                    break
                }
            }
            if (cardsInDeck.length > 0) {
                // Notify that the viewer is opening for this deck
                const openEvt: CustomEvent = new CustomEvent('deckviewer:opened', { detail: { deck } })
                document.dispatchEvent(openEvt)
                const reqEvt: CustomEvent = new CustomEvent('deckviewer:requestOpen', { detail: { cards: cardsInDeck, index: initialIndex } })
                document.dispatchEvent(reqEvt)
            }
        }

        // Clean up
        resetDragState(dragState)
        return
    }

    // Check if the card is over any deck
    const isOverDeck: boolean = DeckController.isOverAnyDeck(card, decks)
    const deckUnderCard: Deck | null = isOverDeck ? DeckController.getDeckUnderCard(card, decks) : null

    // Store the original parent deck (if it's a deck)
    const originalDeck: Deck | null = decks.includes(dragState.originalParent as Deck) ? dragState.originalParent as Deck : null

    // 1. Handle card dropped over an existing deck
    if (isOverDeck && deckUnderCard) {
        // Remove the card from its current parent
        if (currentParent) {
            currentParent.removeChild(card)
        }

        // Add the card to the deck it's over
        addCardToDeck(card, deckUnderCard, deckWidth, deckHeight, onTitleBarClick)

        // Check if the original deck is now empty and remove it if needed
        if (originalDeck && originalDeck !== deckUnderCard && originalDeck.children.length === 1) {
            // The deck only has its background left (index 0), so it's empty
            // Remove it from the stage and from the decks array
            stage.removeChild(originalDeck)
            const deckIndex: number = decks.indexOf(originalDeck)
            if (deckIndex !== -1) {
                decks.splice(deckIndex, 1)
            }
        }
    }
    // 2. Handle card dropped in an empty space (not over any deck)
    else {
        // Store the current global position of the card
        const globalPosition: Position = card.getGlobalPosition()

        // Remove the card from its current parent
        if (currentParent) {
            currentParent.removeChild(card)
        }

        // Add the card to the stage temporarily to use global coordinates
        stage.addChild(card)
        card.position.set(globalPosition.x, globalPosition.y)

        // Create a new deck at the drop location
        const newDeck: Deck = createAndPositionNewDeck(
            card,
            createDeck,
            deckWidth,
            deckHeight,
            appWidth,
            appHeight,
            decks,
        )

        // Add the card to the new deck
        addCardToDeck(card, newDeck, deckWidth, deckHeight, onTitleBarClick)

        // Check if the original deck is now empty and remove it if needed
        if (originalDeck && originalDeck.children.length === 1) {
            // The deck only has its background left (index 0), so it's empty
            // Remove it from the stage and from the decks array
            stage.removeChild(originalDeck)
            const deckIndex: number = decks.indexOf(originalDeck)
            if (deckIndex !== -1) {
                decks.splice(deckIndex, 1)
            }
        }
    }

    // Clean up
    resetDragState(dragState)
}

/**
 * Relocates a card to a global (screen) position as if dropped there from the viewer
 * If dropped over an existing deck, adds to that deck; otherwise creates a new deck
 */
export function relocateCardAtGlobalPosition(
    card: Card,
    globalX: number,
    globalY: number,
    decks: Deck[],
    stage: Container,
    createDeck: () => Deck,
    deckWidth: number,
    deckHeight: number,
    appWidth: number,
    appHeight: number,
    onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
): void {
    // Track original deck if any
    const originalDeck: Deck | null = decks.includes(card.parent as Deck) ? card.parent as Deck : null

    // If dropping onto the same card (self-drop) inside its original bounds, do nothing
    if (originalDeck) {
        const originalTopLeft: Position = card.getGlobalPosition()
        const originalRect: { x: number; y: number; w: number; h: number } = {
            x: originalTopLeft.x,
            y: originalTopLeft.y,
            w: card.width,
            h: card.height,
        }
        if (globalX >= originalRect.x && globalX <= originalRect.x + originalRect.w && globalY >= originalRect.y && globalY <= originalRect.y + originalRect.h) {
            return
        }
    }

    // Remove from current parent
    if (card.parent) {
        card.parent.removeChild(card)
    }

    // Add to stage and position centered at cursor
    stage.addChild(card)
    const targetX: number = globalX - (card.width / 2)
    const targetY: number = globalY - (card.height / 2)
    card.position.set(targetX, targetY)

    // Check if over an existing deck
    const deckUnderCard: Deck | null = DeckController.getDeckUnderCard(card, decks)

    if (deckUnderCard) {
        addCardToDeck(card, deckUnderCard, deckWidth, deckHeight, onTitleBarClick)

        // Remove original deck if it became empty and is different from target
        if (originalDeck && originalDeck !== deckUnderCard && originalDeck.children.length === 1) {
            stage.removeChild(originalDeck)
            const idx: number = decks.indexOf(originalDeck)
            if (idx !== -1) {
                decks.splice(idx, 1)
            }
        }
    } else {
        // Not over any deck: create a new one at the drop location
        const newDeck: Deck = createAndPositionNewDeck(
            card,
            createDeck,
            deckWidth,
            deckHeight,
            appWidth,
            appHeight,
            decks,
        )
        addCardToDeck(card, newDeck, deckWidth, deckHeight, onTitleBarClick)

        if (originalDeck && originalDeck.children.length === 1) {
            stage.removeChild(originalDeck)
            const idx: number = decks.indexOf(originalDeck)
            if (idx !== -1) {
                decks.splice(idx, 1)
            }
        }
    }
}

/**
 * Handles the start of dragging a deck by its title bar
 * @param event - The pointer event
 * @param dragState - The drag state to update
 * @param stage - The stage to add event listeners to
 * @param onDeckDragMove - The function to call when the deck is moved
 * @param onDeckDragEnd - The function to call when the deck drag ends
 */
export function onDeckDragStart(
    event: FederatedPointerEvent,
    dragState: DeckDragState,
    stage: Container,
    onDeckDragMove: (event: FederatedPointerEvent) => void,
    onDeckDragEnd: () => void,
): void {
    // Get the title bar hit area that was clicked
    const titleBarHitArea: Container = event.currentTarget as Container

    // If there's no title bar hit area, return early
    if (!titleBarHitArea) {
        return
    }

    // Get the parent (deckBackground) of the hit area
    const deckBackground: Container = titleBarHitArea.parent as Container

    // If there's no deck background, return early
    if (!deckBackground) {
        return
    }

    // Get the parent deck of the background
    const deck: Deck = deckBackground.parent as Deck

    // If there's no deck, return early
    if (!deck) {
        return
    }

    // Set the drag target to the deck
    dragState.dragDeckTarget = deck

    // Get the global position of the deck
    const deckGlobalPosition: Position = deck.getGlobalPosition()

    // Calculate the offset between the cursor position and the deck's global position
    dragState.dragDeckOffset.x = deckGlobalPosition.x - event.global.x
    dragState.dragDeckOffset.y = deckGlobalPosition.y - event.global.y

    // Bring the deck to the top by removing it and adding it back
    stage.removeChild(deck)
    stage.addChild(deck)

    // Add the pointermove event listener to the stage
    if (typeof stage.on === 'function') {
        stage.on('pointermove', onDeckDragMove)

        // Add the pointerup and pointerupoutside event listeners to the stage
        stage.on('pointerup', onDeckDragEnd)
        stage.on('pointerupoutside', onDeckDragEnd)
    }

    // Prevent the default behavior to ensure the drag works properly
    event.stopPropagation()
}

/**
 * Handles the movement of a deck during dragging
 * @param event - The pointer event
 * @param dragState - The drag state to update
 * @param stage - The stage to get local position from
 * @param appWidth - The width of the application
 * @param appHeight - The height of the application
 */
export function onDeckDragMove(
    event: FederatedPointerEvent,
    dragState: DeckDragState,
    stage: Container,
    appWidth: number,
    appHeight: number,
): void {
    if (!dragState.dragDeckTarget) {
        return
    }

    // Calculate the new position of the deck using global coordinates
    const newGlobalX: number = event.global.x + dragState.dragDeckOffset.x
    const newGlobalY: number = event.global.y + dragState.dragDeckOffset.y

    // Constrain the global position to keep it within the viewport
    const constrainedGlobalPosition: Position = constrainPosition(
        newGlobalX,
        newGlobalY,
        dragState.dragDeckTarget.width,
        dragState.dragDeckTarget.height,
        appWidth,
        appHeight,
    )

    // Convert constrained global position to local position relative to the stage
    const constrainedPosition: Position = stage.toLocal(constrainedGlobalPosition)
    dragState.dragDeckTarget.x = constrainedPosition.x
    dragState.dragDeckTarget.y = constrainedPosition.y
}

/**
 * Handles the end of dragging a deck
 * @param dragState - The drag state to update
 * @param stage - The stage to remove event listeners from
 * @param onDeckDragMove - The function to remove from event listeners
 * @param onDeckDragEnd - The function to remove from event listeners
 */
export function onDeckDragEnd(
    dragState: DeckDragState,
    stage: Container,
    onDeckDragMove: (event: FederatedPointerEvent) => void,
    onDeckDragEnd: () => void,
): void {
    if (!dragState.dragDeckTarget) {
        return
    }

    // Remove the pointermove event listener from the stage
    if (typeof stage.off === 'function') {
        stage.off('pointermove', onDeckDragMove)

        // Remove the pointerup and pointerupoutside event listeners from the stage
        stage.off('pointerup', onDeckDragEnd)
        stage.off('pointerupoutside', onDeckDragEnd)
    }

    // Reset the drag target
    dragState.dragDeckTarget = null
}
