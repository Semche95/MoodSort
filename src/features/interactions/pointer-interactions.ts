import { Container, FederatedPointerEvent } from 'pixi.js'
import { Position } from '../../types/position.types'
import { PointerInteractions, PointerInteractionsDeps } from '../../types/pointer-interactions.types'
import { Card } from '../../types/card.types'
import { ForcedCursor } from '../../types/forced-cursor.types'
import { findStackAtPoint } from '../stack/stack'
import { findStackByCompactButtonAtPoint, isPointInBox } from '../stack/stack-hit-testing'
import { findNameAnchor } from '../stack/stack-naming'
import { isModKeyPressed } from '../../shared/utils/mod-key'

function findCardStack(deps: PointerInteractionsDeps, card: Card): Card[] {
    return deps.getStacks().find((stack: Card[]): boolean => stack.includes(card)) ?? [card]
}

function findTopCardAt(cardLayer: Container, point: Position): Card | null {
    const cards = cardLayer.children.filter((child: Container): child is Card => 'imageUrl' in child)
    return cards.reverse().find((card: Card): boolean => isPointInBox(point, card)) ?? null
}

/** UI drawn above the card layer, such as a toolbar button, hides the cards and stack frames under it from the pointer. */
function isCoveredByUi(deps: PointerInteractionsDeps, point: Position): boolean {
    let target = deps.hitTest(point)
    if (!target?.parent) {
        return false
    }
    for (; target; target = target.parent) {
        if (target === deps.cardLayer) {
            return false
        }
    }
    return true
}

/** Pill buttons sit under every card, so they only take a press no card covers. */
function isOnPillButton(deps: PointerInteractionsDeps, point: Position): boolean {
    return findStackByCompactButtonAtPoint(deps.getStacks(), point) !== null || deps.overlay.findStackByNameButtonAtPoint(point) !== null
}

function startStackDrag(deps: PointerInteractionsDeps, stack: Card[], point: Position): void {
    deps.overlay.commitNameEditorIfOpen()
    deps.stackDragManager.startDrag(stack, stack, point)
}

export function createPointerInteractions(deps: PointerInteractionsDeps): PointerInteractions {
    let pointer: Position | null = null
    let modKeyHeld = false

    /** Runs after any card, grip or button under the press: a press none of them took carries the armed stack, if any. */
    const handleStagePointerDown = (e: FederatedPointerEvent): void => {
        pointer = { x: e.global.x, y: e.global.y }
        modKeyHeld = isModKeyPressed(e)
        const stack = findArmedStack()
        if (stack) {
            startStackDrag(deps, stack, pointer)
            return
        }
        deps.overlay.commitNameEditorIfOpen()
    }

    /** With Ctrl/Cmd held the press is left to the stage, which carries the whole stack; the choice is locked until release. */
    const handleCardPointerDown = (e: FederatedPointerEvent): void => {
        if (deps.isCompacting() || isModKeyPressed(e)) {
            return
        }
        deps.overlay.commitNameEditorIfOpen()
        deps.dragHandler.handleDragStart(e)
    }

    const handlePointerMove = (e: FederatedPointerEvent): void => {
        pointer = { x: e.global.x, y: e.global.y }
        // A replayed move carries no modifier state, so it must not disarm a key still held.
        if (!('isTrusted' in e.nativeEvent) || e.nativeEvent.isTrusted) {
            modKeyHeld = isModKeyPressed(e)
        }
        if (deps.dragHandler.isDragging) {
            deps.overlay.hide()
            deps.overlay.setHoveredStack(null)
            return
        }
        if (deps.stackDragManager.isDragging) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = isCoveredByUi(deps, point) ? null : findStackAtPoint(deps.getStacks(), point)
        deps.overlay.setHoveredStack(stack)
        if (stack) {
            deps.overlay.showHighlight(stack)
            return
        }
        deps.overlay.hide()
    }

    const handlePointerOut = (): void => {
        if (!deps.stackDragManager.isDragging) {
            deps.overlay.hide()
            deps.overlay.setHoveredStack(null)
        }
    }

    const handlePointerLeave = (): void => {
        pointer = null
    }

    /** macOS turns Ctrl+click into a context menu, which would swallow the release of the drag it started. */
    const handleContextMenu = (e: MouseEvent): void => {
        if (deps.dragHandler.isDragging || deps.stackDragManager.isDragging) {
            e.preventDefault()
        }
    }

    /** Firefox otherwise turns a press and move on the canvas into a text selection or a native drag, which swallows the pointer events. */
    const handleMouseDown = (e: MouseEvent): void => {
        e.preventDefault()
    }

    const handleModKey = (e: KeyboardEvent): void => {
        modKeyHeld = isModKeyPressed(e)
    }

    /** A key released while the window is unfocused never reaches it. */
    const handleWindowBlur = (): void => {
        modKeyHeld = false
    }

    /**
     * The stack a press would carry whole right now: Ctrl/Cmd held anywhere within its frame but on a pill button
     * or under UI drawn above the cards, the card on top deciding where frames overlap.
     */
    const findArmedStack = (): Card[] | null => {
        if (!modKeyHeld || !pointer || deps.isBusy() || isCoveredByUi(deps, pointer)) {
            return null
        }
        const card = findTopCardAt(deps.cardLayer, pointer)
        if (card) {
            return findCardStack(deps, card)
        }
        return isOnPillButton(deps, pointer) ? null : findStackAtPoint(deps.getStacks(), pointer)
    }

    /** Overrides whatever lies under the pointer, which a carried stack often leaves behind. */
    const findForcedCursor = (): ForcedCursor | null => {
        if (deps.stackDragManager.isDragging) {
            return 'grabbing'
        }
        return findArmedStack() ? 'grab' : null
    }

    /** Topmost card under the last known pointer, by z-order; none while a stack is carried or armed, so only its pile is marked. */
    const findHoveredCard = (): Card | null => {
        if (!pointer || deps.stackDragManager.isDragging || findArmedStack() || isCoveredByUi(deps, pointer)) {
            return null
        }
        return findTopCardAt(deps.cardLayer, pointer)
    }

    const handleDragHandlePointerDown = (e: FederatedPointerEvent): void => {
        if (deps.dragHandler.isDragging || deps.isCompacting()) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackAtPoint(deps.getStacks(), point)
        if (!stack) {
            return
        }
        startStackDrag(deps, stack, point)
    }

    const handleCompactButtonPointerDown = (e: FederatedPointerEvent): void => {
        if (deps.isBusy()) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackByCompactButtonAtPoint(deps.getStacks(), point)
        if (!stack) {
            return
        }
        deps.overlay.commitNameEditorIfOpen()
        deps.onCompactButton(stack)
    }

    const handleNameButtonPointerDown = (e: FederatedPointerEvent): void => {
        if (deps.isBusy()) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = deps.overlay.findStackByNameButtonAtPoint(point)
        if (!stack) {
            return
        }
        deps.overlay.commitNameEditorIfOpen()
        const anchor = findNameAnchor(stack, deps.cardLayer, deps.getStackNames())
        const currentName = deps.getStackNames()[anchor.imageUrl] ?? null
        deps.actionHistory.captureBefore([], { [anchor.imageUrl]: currentName })
        deps.overlay.openNameEditor(
            stack,
            currentName ?? '',
            (value: string): void => deps.onCommitStackName(anchor, value),
            (): void => deps.onCancelStackNameEdit(),
        )
    }

    return {
        handleStagePointerDown,
        handleCardPointerDown,
        handlePointerMove,
        handlePointerOut,
        handlePointerLeave,
        handleContextMenu,
        handleMouseDown,
        handleModKey,
        handleWindowBlur,
        findArmedStack,
        findForcedCursor,
        findHoveredCard,
        handleDragHandlePointerDown,
        handleCompactButtonPointerDown,
        handleNameButtonPointerDown,
    }
}
