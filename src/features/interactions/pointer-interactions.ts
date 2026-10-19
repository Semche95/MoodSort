import { Container, FederatedPointerEvent } from 'pixi.js'
import { Position } from '../../types/position.types'
import { PointerInteractions, PointerInteractionsDeps } from '../../types/pointer-interactions.types'
import { Card } from '../../types/card.types'
import { findStackAtPoint } from '../stack/stack'
import { findStackByCompactButtonAtPoint, isPointInBox } from '../stack/stack-hit-testing'
import { findNameAnchor } from '../stack/stack-naming'

export function createPointerInteractions(deps: PointerInteractionsDeps): PointerInteractions {
    let pointer: Position | null = null

    const handleStagePointerDown = (): void => {
        deps.overlay.commitNameEditorIfOpen()
    }

    const handleCardPointerDown = (e: FederatedPointerEvent): void => {
        if (deps.isCompacting()) {
            return
        }
        deps.overlay.commitNameEditorIfOpen()
        deps.dragHandler.handleDragStart(e)
    }

    const handlePointerMove = (e: FederatedPointerEvent): void => {
        pointer = { x: e.global.x, y: e.global.y }
        if (deps.dragHandler.isDragging) {
            deps.overlay.hide()
            deps.overlay.setHoveredStack(null)
            return
        }
        if (deps.stackDragManager.isDragging) {
            return
        }
        const point: Position = { x: e.global.x, y: e.global.y }
        const stack = findStackAtPoint(deps.getStacks(), point)
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

    /** Topmost card under the last known pointer, by z-order; none while a stack is carried, so the pile it passes over stays unmarked. */
    const findHoveredCard = (): Card | null => {
        if (!pointer || deps.stackDragManager.isDragging) {
            return null
        }
        const point = pointer
        const cards = deps.cardLayer.children.filter((child: Container): child is Card => 'imageUrl' in child)
        return cards.reverse().find((card: Card): boolean => isPointInBox(point, card)) ?? null
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
        deps.overlay.commitNameEditorIfOpen()
        deps.stackDragManager.startDrag(
            stack,
            stack,
            point,
        )
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
        findHoveredCard,
        handleDragHandlePointerDown,
        handleCompactButtonPointerDown,
        handleNameButtonPointerDown,
    }
}
