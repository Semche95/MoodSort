import { Container, FederatedPointerEvent } from 'pixi.js'
import { Card } from './card.types'
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
    getStackNames: () => Record<string, string>
    isBusy: () => boolean
    isCompacting: () => boolean
    onCompactButton: (stack: Card[]) => void
    onCommitStackName: (anchor: Card, value: string) => void
    onCancelStackNameEdit: () => void
}

export interface PointerInteractions {
    handleStagePointerDown: () => void
    handleCardPointerDown: (e: FederatedPointerEvent) => void
    handlePointerMove: (e: FederatedPointerEvent) => void
    handlePointerOut: () => void
    handleDragHandlePointerDown: (e: FederatedPointerEvent) => void
    handleCompactButtonPointerDown: (e: FederatedPointerEvent) => void
    handleNameButtonPointerDown: (e: FederatedPointerEvent) => void
}
