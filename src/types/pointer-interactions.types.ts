import { Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from './card.types'
import { Position } from './position.types'
import { ForcedCursor } from './forced-cursor.types'
import { DragHandler } from '../features/drag/drag-handler'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { StackDragManager } from '../features/stack/stack-drag-manager'
import { ActionHistory } from '../features/history/action-history'

export interface PointerInteractionsDeps {
    cardLayer: Container
    dragHandler: DragHandler
    overlay: StackOverlay
    stackDragManager: StackDragManager
    actionHistory: ActionHistory
    getStacks: () => Card[][]
    /** Topmost interactive object at `point`, as Pixi's event system would pick it */
    hitTest: (point: Position) => Container | null
    getStackNames: () => Record<string, string>
    isBusy: () => boolean
    isCompacting: () => boolean
    onCompactButton: (stack: Card[]) => void
    onCommitStackName: (anchor: Card, value: string) => void
    onCancelStackNameEdit: () => void
}

export interface PointerInteractions {
    handleStagePointerDown: (e: FederatedPointerEvent) => void
    handleCardPointerDown: (e: FederatedPointerEvent) => void
    handlePointerMove: (e: FederatedPointerEvent) => void
    handlePointerOut: () => void
    handlePointerLeave: () => void
    handleContextMenu: (e: MouseEvent) => void
    handleMouseDown: (e: MouseEvent) => void
    handleModKey: (e: KeyboardEvent) => void
    handleWindowBlur: () => void
    findArmedStack: () => Card[] | null
    findForcedCursor: () => ForcedCursor | null
    findHoveredCard: () => Card | null
    handleDragHandlePointerDown: (e: FederatedPointerEvent) => void
    handleCompactButtonPointerDown: (e: FederatedPointerEvent) => void
    handleNameButtonPointerDown: (e: FederatedPointerEvent) => void
}
