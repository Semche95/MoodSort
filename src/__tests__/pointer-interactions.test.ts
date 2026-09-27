import { describe, expect, it, vi } from 'vitest'
import type { FederatedPointerEvent } from 'pixi.js'
import { createPointerInteractions } from '../features/interactions/pointer-interactions'
import { Card } from '../types/card.types'
import { computeCompactButtonBox, computeNameButtonBox } from '../features/stack/stack-hit-testing'
import { computeLabelAnchorPoint } from '../features/stack/stack-naming'
import { PointerInteractionsDeps } from '../types/pointer-interactions.types'

function makeCard(x: number, y: number, width: number = 200, height: number = 300, imageUrl: string = 'card'): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

function makeEvent(x: number, y: number): FederatedPointerEvent {
    return { global: { x, y } } as unknown as FederatedPointerEvent
}

function makeDeps(overrides: Partial<PointerInteractionsDeps> = {}): {
    deps: PointerInteractionsDeps
    overlay: {
        commitNameEditorIfOpen: ReturnType<typeof vi.fn>
        hide: ReturnType<typeof vi.fn>
        setHoveredStack: ReturnType<typeof vi.fn>
        showHighlight: ReturnType<typeof vi.fn>
        openNameEditor: ReturnType<typeof vi.fn>
    }
    dragHandler: { isDragging: boolean; handleDragStart: ReturnType<typeof vi.fn> }
    stackDragManager: { isDragging: boolean; startDrag: ReturnType<typeof vi.fn> }
    actionHistory: { captureBefore: ReturnType<typeof vi.fn> }
    cardLayer: { children: unknown[] }
} {
    const overlay = {
        commitNameEditorIfOpen: vi.fn(),
        hide: vi.fn(),
        setHoveredStack: vi.fn(),
        showHighlight: vi.fn(),
        openNameEditor: vi.fn(),
    }
    const dragHandler = { isDragging: false, handleDragStart: vi.fn() }
    const stackDragManager = { isDragging: false, startDrag: vi.fn() }
    const actionHistory = { captureBefore: vi.fn() }
    const cardLayer = { children: [] as unknown[] }

    const deps: PointerInteractionsDeps = {
        cardLayer: cardLayer as unknown as PointerInteractionsDeps['cardLayer'],
        dragHandler: dragHandler as unknown as PointerInteractionsDeps['dragHandler'],
        overlay: overlay as unknown as PointerInteractionsDeps['overlay'],
        stackDragManager: stackDragManager as unknown as PointerInteractionsDeps['stackDragManager'],
        actionHistory: actionHistory as unknown as PointerInteractionsDeps['actionHistory'],
        getStacks: (): Card[][] => [],
        getStackNames: (): Record<string, string> => ({}),
        isBusy: (): boolean => false,
        isCompacting: (): boolean => false,
        onCompactButton: vi.fn(),
        onCommitStackName: vi.fn(),
        onCancelStackNameEdit: vi.fn(),
        ...overrides,
    }

    return { deps, overlay, dragHandler, stackDragManager, actionHistory, cardLayer }
}

describe('createPointerInteractions', () => {
    it('handleStagePointerDown commits any pending stack-name edit', () => {
        const { deps, overlay } = makeDeps()
        const interactions = createPointerInteractions(deps)

        interactions.handleStagePointerDown()

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
    })

    it('handleCardPointerDown no-ops while compacting', () => {
        const { deps, overlay, dragHandler } = makeDeps({ isCompacting: (): boolean => true })
        const interactions = createPointerInteractions(deps)

        interactions.handleCardPointerDown(makeEvent(0, 0))

        expect(overlay.commitNameEditorIfOpen).not.toHaveBeenCalled()
        expect(dragHandler.handleDragStart).not.toHaveBeenCalled()
    })

    it('handleCardPointerDown commits any pending edit and starts a card drag otherwise', () => {
        const { deps, overlay, dragHandler } = makeDeps()
        const interactions = createPointerInteractions(deps)
        const event = makeEvent(0, 0)

        interactions.handleCardPointerDown(event)

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(dragHandler.handleDragStart).toHaveBeenCalledWith(event)
    })

    it('handlePointerMove hides the overlay highlight while a card is being dragged', () => {
        const { deps, overlay, dragHandler } = makeDeps()
        dragHandler.isDragging = true
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(0, 0))

        expect(overlay.hide).toHaveBeenCalledTimes(1)
        expect(overlay.setHoveredStack).toHaveBeenCalledWith(null)
        expect(overlay.showHighlight).not.toHaveBeenCalled()
    })

    it('handlePointerMove does nothing while a stack is being dragged', () => {
        const { deps, overlay, stackDragManager } = makeDeps()
        stackDragManager.isDragging = true
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(0, 0))

        expect(overlay.hide).not.toHaveBeenCalled()
        expect(overlay.setHoveredStack).not.toHaveBeenCalled()
    })

    it('handlePointerMove shows the highlight when the pointer is over a stack', () => {
        const stack = [makeCard(100, 100)]
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(150, 150))

        expect(overlay.setHoveredStack).toHaveBeenCalledWith(stack)
        expect(overlay.showHighlight).toHaveBeenCalledWith(stack)
        expect(overlay.hide).not.toHaveBeenCalled()
    })

    it('handlePointerMove hides the overlay when the pointer is over no stack', () => {
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [] })
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(-9999, -9999))

        expect(overlay.setHoveredStack).toHaveBeenCalledWith(null)
        expect(overlay.hide).toHaveBeenCalledTimes(1)
    })

    it('handlePointerOut hides the overlay highlight when no stack drag is in progress', () => {
        const { deps, overlay } = makeDeps()
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerOut()

        expect(overlay.hide).toHaveBeenCalledTimes(1)
        expect(overlay.setHoveredStack).toHaveBeenCalledWith(null)
    })

    it('handlePointerOut leaves the overlay alone while a stack drag is in progress', () => {
        const { deps, overlay, stackDragManager } = makeDeps()
        stackDragManager.isDragging = true
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerOut()

        expect(overlay.hide).not.toHaveBeenCalled()
        expect(overlay.setHoveredStack).not.toHaveBeenCalled()
    })

    it('handleDragHandlePointerDown no-ops while a card is being dragged', () => {
        const stack = [makeCard(100, 100)]
        const { deps, dragHandler, stackDragManager } = makeDeps({ getStacks: (): Card[][] => [stack] })
        dragHandler.isDragging = true
        const interactions = createPointerInteractions(deps)

        interactions.handleDragHandlePointerDown(makeEvent(150, 150))

        expect(stackDragManager.startDrag).not.toHaveBeenCalled()
    })

    it('handleDragHandlePointerDown no-ops while compacting', () => {
        const stack = [makeCard(100, 100)]
        const { deps, stackDragManager } = makeDeps({
            getStacks: (): Card[][] => [stack],
            isCompacting: (): boolean => true,
        })
        const interactions = createPointerInteractions(deps)

        interactions.handleDragHandlePointerDown(makeEvent(150, 150))

        expect(stackDragManager.startDrag).not.toHaveBeenCalled()
    })

    it('handleDragHandlePointerDown no-ops when the point is not on a stack', () => {
        const { deps, stackDragManager } = makeDeps({ getStacks: (): Card[][] => [] })
        const interactions = createPointerInteractions(deps)

        interactions.handleDragHandlePointerDown(makeEvent(-9999, -9999))

        expect(stackDragManager.startDrag).not.toHaveBeenCalled()
    })

    it('handleDragHandlePointerDown commits any pending edit and starts a stack drag otherwise', () => {
        const stack = [makeCard(100, 100)]
        const { deps, overlay, stackDragManager } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)

        interactions.handleDragHandlePointerDown(makeEvent(150, 150))

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(stackDragManager.startDrag).toHaveBeenCalledWith(stack, stack, { x: 150, y: 150 })
    })

    it('handleCompactButtonPointerDown no-ops while busy', () => {
        const stack = [makeCard(100, 100), makeCard(110, 110)]
        const { deps } = makeDeps({ getStacks: (): Card[][] => [stack], isBusy: (): boolean => true })
        const interactions = createPointerInteractions(deps)
        const box = computeCompactButtonBox(stack)!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        interactions.handleCompactButtonPointerDown(makeEvent(point.x, point.y))

        expect(deps.onCompactButton).not.toHaveBeenCalled()
    })

    it('handleCompactButtonPointerDown no-ops when the point misses the compact button', () => {
        const stack = [makeCard(100, 100), makeCard(110, 110)]
        const { deps } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)

        interactions.handleCompactButtonPointerDown(makeEvent(-9999, -9999))

        expect(deps.onCompactButton).not.toHaveBeenCalled()
    })

    it('handleCompactButtonPointerDown commits any pending edit and invokes onCompactButton on target', () => {
        const stack = [makeCard(100, 100), makeCard(110, 110)]
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)
        const box = computeCompactButtonBox(stack)!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        interactions.handleCompactButtonPointerDown(makeEvent(point.x, point.y))

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(deps.onCompactButton).toHaveBeenCalledWith(stack)
    })

    it('handleNameButtonPointerDown no-ops while busy', () => {
        const stack = [makeCard(100, 100)]
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [stack], isBusy: (): boolean => true })
        const interactions = createPointerInteractions(deps)
        const box = computeNameButtonBox(stack)
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        interactions.handleNameButtonPointerDown(makeEvent(point.x, point.y))

        expect(overlay.openNameEditor).not.toHaveBeenCalled()
    })

    it('handleNameButtonPointerDown no-ops when the point misses the name button', () => {
        const stack = [makeCard(100, 100)]
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)

        interactions.handleNameButtonPointerDown(makeEvent(-9999, -9999))

        expect(overlay.openNameEditor).not.toHaveBeenCalled()
    })

    it('handleNameButtonPointerDown opens the name editor prefilled with the current name at the label anchor', () => {
        const anchor = makeCard(100, 100, 200, 300, 'card-a')
        const stack = [anchor]
        const cardLayer = { children: [anchor] }
        const { deps, overlay, actionHistory } = makeDeps({
            getStacks: (): Card[][] => [stack],
            getStackNames: (): Record<string, string> => ({ 'card-a': 'Joie' }),
            cardLayer: cardLayer as unknown as PointerInteractionsDeps['cardLayer'],
        })
        const interactions = createPointerInteractions(deps)
        const box = computeNameButtonBox(stack)
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        interactions.handleNameButtonPointerDown(makeEvent(point.x, point.y))

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(actionHistory.captureBefore).toHaveBeenCalledWith([], { 'card-a': 'Joie' })
        expect(overlay.openNameEditor).toHaveBeenCalledTimes(1)
        const labelPoint = computeLabelAnchorPoint(stack)
        const call = overlay.openNameEditor.mock.calls[0]
        expect(call[0]).toBe(labelPoint.x)
        expect(call[1]).toBe(labelPoint.y)
        expect(call[2]).toBe('Joie')
    })

    it('handleNameButtonPointerDown wires its commit callback to onCommitStackName with the anchor card', () => {
        const anchor = makeCard(100, 100, 200, 300, 'card-a')
        const stack = [anchor]
        const cardLayer = { children: [anchor] }
        const { deps, overlay } = makeDeps({
            getStacks: (): Card[][] => [stack],
            cardLayer: cardLayer as unknown as PointerInteractionsDeps['cardLayer'],
        })
        const interactions = createPointerInteractions(deps)
        const box = computeNameButtonBox(stack)
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        interactions.handleNameButtonPointerDown(makeEvent(point.x, point.y))

        const onCommit = overlay.openNameEditor.mock.calls[0][3] as (value: string) => void
        onCommit('Colère')
        expect(deps.onCommitStackName).toHaveBeenCalledWith(anchor, 'Colère')

        const onCancel = overlay.openNameEditor.mock.calls[0][4] as () => void
        onCancel()
        expect(deps.onCancelStackNameEdit).toHaveBeenCalledTimes(1)
    })
})
