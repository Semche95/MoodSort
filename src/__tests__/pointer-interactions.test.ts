import { describe, expect, it, vi } from 'vitest'
import type { FederatedPointerEvent } from 'pixi.js'
import { createPointerInteractions } from '../features/interactions/pointer-interactions'
import { Card } from '../types/card.types'
import { computeCompactButtonBox } from '../features/stack/stack-hit-testing'
import { PointerInteractionsDeps } from '../types/pointer-interactions.types'

function makeCard(x: number, y: number, width: number = 200, height: number = 300, imageUrl: string = 'card'): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

function makeEvent(x: number, y: number, extra: { ctrlKey?: boolean, metaKey?: boolean, currentTarget?: Card, nativeEvent?: { isTrusted: boolean } } = {}): FederatedPointerEvent {
    return { global: { x, y }, ctrlKey: false, metaKey: false, nativeEvent: { isTrusted: true }, ...extra } as unknown as FederatedPointerEvent
}

function makeDeps(overrides: Partial<PointerInteractionsDeps> = {}): {
    deps: PointerInteractionsDeps
    overlay: {
        commitNameEditorIfOpen: ReturnType<typeof vi.fn>
        hide: ReturnType<typeof vi.fn>
        setHoveredStack: ReturnType<typeof vi.fn>
        showHighlight: ReturnType<typeof vi.fn>
        openNameEditor: ReturnType<typeof vi.fn>
        findStackByNameButtonAtPoint: ReturnType<typeof vi.fn>
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
        findStackByNameButtonAtPoint: vi.fn((): Card[] | null => null),
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
        const { deps, overlay, stackDragManager } = makeDeps()
        const interactions = createPointerInteractions(deps)

        interactions.handleStagePointerDown(makeEvent(0, 0))

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(stackDragManager.startDrag).not.toHaveBeenCalled()
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

    it('handleCardPointerDown with Ctrl or Cmd held leaves the press to the stage', () => {
        for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
            const { deps, overlay, dragHandler, stackDragManager } = makeDeps()
            const interactions = createPointerInteractions(deps)

            interactions.handleCardPointerDown(makeEvent(150, 150, mod))

            expect(overlay.commitNameEditorIfOpen).not.toHaveBeenCalled()
            expect(dragHandler.handleDragStart).not.toHaveBeenCalled()
            expect(stackDragManager.startDrag).not.toHaveBeenCalled()
        }
    })

    it('handleStagePointerDown with Ctrl or Cmd held carries the stack of the top card under the press', () => {
        const card = makeCard(100, 100)
        const stack = [makeCard(80, 80), card]
        for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
            const { deps, overlay, stackDragManager, cardLayer } = makeDeps({ getStacks: (): Card[][] => [[makeCard(900, 900)], stack] })
            cardLayer.children.push(...stack)
            const interactions = createPointerInteractions(deps)

            interactions.handleStagePointerDown(makeEvent(150, 150, mod))

            expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
            expect(stackDragManager.startDrag).toHaveBeenCalledWith(stack, stack, { x: 150, y: 150 })
        }
    })

    it('handleStagePointerDown with Ctrl held carries the stack whose frame holds a press between its cards', () => {
        const stack = [makeCard(0, 0), makeCard(100, 100)]
        const { deps, stackDragManager, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)

        interactions.handleStagePointerDown(makeEvent(250, 50, { ctrlKey: true }))

        expect(stackDragManager.startDrag).toHaveBeenCalledWith(stack, stack, { x: 250, y: 50 })
    })

    it('handleStagePointerDown with Ctrl held carries a card missing from the known stacks on its own', () => {
        const card = makeCard(100, 100)
        const { deps, stackDragManager, cardLayer } = makeDeps()
        cardLayer.children.push(card)
        const interactions = createPointerInteractions(deps)

        interactions.handleStagePointerDown(makeEvent(150, 150, { ctrlKey: true }))

        expect(stackDragManager.startDrag).toHaveBeenCalledWith([card], [card], { x: 150, y: 150 })
    })

    it('handleStagePointerDown with Ctrl held carries nothing once a card, grip or button took the press, or outside any stack', () => {
        const card = makeCard(100, 100)
        let busy = true
        const { deps, overlay, stackDragManager, cardLayer } = makeDeps({ getStacks: (): Card[][] => [[card]], isBusy: (): boolean => busy })
        cardLayer.children.push(card)
        const interactions = createPointerInteractions(deps)

        interactions.handleStagePointerDown(makeEvent(150, 150, { ctrlKey: true }))
        busy = false
        interactions.handleStagePointerDown(makeEvent(900, 900, { ctrlKey: true }))

        expect(stackDragManager.startDrag).not.toHaveBeenCalled()
        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(2)
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

    it('findHoveredCard returns nothing before the pointer ever moved over the canvas', () => {
        const { deps, cardLayer } = makeDeps()
        cardLayer.children.push(makeCard(0, 0))
        const interactions = createPointerInteractions(deps)

        expect(interactions.findHoveredCard()).toBeNull()
    })

    it('findHoveredCard returns the topmost card under the pointer, skipping non-card children', () => {
        const { deps, cardLayer } = makeDeps()
        const below = makeCard(0, 0, 200, 300, 'below')
        const above = makeCard(100, 0, 200, 300, 'above')
        cardLayer.children.push(below, above, { x: 0, y: 0, width: 1000, height: 1000 })
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(150, 10))
        expect(interactions.findHoveredCard()).toBe(above)

        interactions.handlePointerMove(makeEvent(50, 10))
        expect(interactions.findHoveredCard()).toBe(below)

        interactions.handlePointerMove(makeEvent(500, 10))
        expect(interactions.findHoveredCard()).toBeNull()
    })

    it('findHoveredCard follows cards moving under a still pointer, without a new pointer event', () => {
        const { deps, cardLayer } = makeDeps()
        const card = makeCard(0, 0)
        cardLayer.children.push(card)
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 10))

        card.x = 500

        expect(interactions.findHoveredCard()).toBeNull()
    })

    it('findHoveredCard returns nothing while a stack is being dragged', () => {
        const { deps, cardLayer, stackDragManager } = makeDeps()
        cardLayer.children.push(makeCard(0, 0))
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 10))

        stackDragManager.isDragging = true

        expect(interactions.findHoveredCard()).toBeNull()
    })

    it('findArmedStack returns the whole stack while Ctrl or Cmd is held anywhere within its frame, cards or not', () => {
        const top = makeCard(0, 0, 200, 300, 'top')
        const bottom = makeCard(100, 100, 200, 300, 'bottom')
        const stack = [bottom, top]
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(bottom, top)
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(50, 50))
        expect(interactions.findArmedStack()).toBeNull()

        interactions.handlePointerMove(makeEvent(250, 50, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBe(stack)

        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBe(stack)

        interactions.handlePointerMove(makeEvent(50, 50, { metaKey: true }))
        expect(interactions.findArmedStack()).toBe(stack)

        interactions.handlePointerMove(makeEvent(900, 900, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBeNull()
    })

    it('handlePointerMove keeps a held key armed through a replayed move, which carries no modifier state', () => {
        const stack = [makeCard(0, 0)]
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))

        interactions.handlePointerMove(makeEvent(60, 60, { nativeEvent: { isTrusted: false } }))

        expect(interactions.findArmedStack()).toBe(stack)
    })

    it('handleModKey arms and disarms the stack under a still pointer as the key goes down and up', () => {
        const stack = [makeCard(0, 0)]
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 50))

        interactions.handleModKey(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }))
        expect(interactions.findArmedStack()).toBe(stack)

        interactions.handleModKey(new KeyboardEvent('keyup', { key: 'Control' }))
        expect(interactions.findArmedStack()).toBeNull()
    })

    it('handleWindowBlur disarms, since the key may be released while the window is unfocused', () => {
        const stack = [makeCard(0, 0)]
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))

        interactions.handleWindowBlur()

        expect(interactions.findArmedStack()).toBeNull()
    })

    it('findArmedStack returns nothing while busy or once the pointer left the canvas', () => {
        let busy = true
        const stack = [makeCard(0, 0)]
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [stack], isBusy: (): boolean => busy })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))

        expect(interactions.findArmedStack()).toBeNull()
        busy = false
        expect(interactions.findArmedStack()).toBe(stack)
        interactions.handlePointerLeave()
        expect(interactions.findArmedStack()).toBeNull()
    })

    it('findArmedStack returns nothing on a pill button no card covers, since the press goes to the button', () => {
        const stack = [makeCard(0, 0, 200, 300, 'a'), makeCard(20, 20, 200, 300, 'b')]
        const { deps, cardLayer, overlay } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)
        const compact = computeCompactButtonBox(stack)!

        interactions.handlePointerMove(makeEvent(compact.x + 1, compact.y + 1, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBeNull()

        overlay.findStackByNameButtonAtPoint.mockReturnValue(stack)
        interactions.handlePointerMove(makeEvent(250, -10, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBeNull()

        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))
        expect(interactions.findArmedStack()).toBe(stack)
    })

    it('findForcedCursor grabs while a stack is armed and keeps grabbing while one is carried, whatever is under the pointer', () => {
        const stack = [makeCard(0, 0)]
        const { deps, cardLayer, stackDragManager } = makeDeps({ getStacks: (): Card[][] => [stack] })
        cardLayer.children.push(...stack)
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(50, 50))
        expect(interactions.findForcedCursor()).toBeNull()

        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))
        expect(interactions.findForcedCursor()).toBe('grab')

        stackDragManager.isDragging = true
        interactions.handlePointerMove(makeEvent(900, 900))
        expect(interactions.findForcedCursor()).toBe('grabbing')
    })

    it('findHoveredCard returns nothing while a stack is armed, so the card outline does not promise a single-card grab', () => {
        const card = makeCard(0, 0)
        const { deps, cardLayer } = makeDeps({ getStacks: (): Card[][] => [[card]] })
        cardLayer.children.push(card)
        const interactions = createPointerInteractions(deps)

        interactions.handlePointerMove(makeEvent(50, 50, { ctrlKey: true }))
        expect(interactions.findHoveredCard()).toBeNull()

        interactions.handleModKey(new KeyboardEvent('keyup', { key: 'Control' }))
        expect(interactions.findHoveredCard()).toBe(card)
    })

    it('handleContextMenu blocks the context menu only while a card or a stack is being dragged', () => {
        const { deps, dragHandler, stackDragManager } = makeDeps()
        const interactions = createPointerInteractions(deps)
        const fire = (): boolean => {
            const event = new MouseEvent('contextmenu', { cancelable: true })
            interactions.handleContextMenu(event)
            return event.defaultPrevented
        }

        expect(fire()).toBe(false)
        stackDragManager.isDragging = true
        expect(fire()).toBe(true)
        stackDragManager.isDragging = false
        dragHandler.isDragging = true
        expect(fire()).toBe(true)
    })

    it('handleMouseDown cancels the native default of every press, so no selection or native drag swallows the pointer events', () => {
        const { deps } = makeDeps()
        const interactions = createPointerInteractions(deps)
        const event = new MouseEvent('mousedown', { cancelable: true })

        interactions.handleMouseDown(event)

        expect(event.defaultPrevented).toBe(true)
    })

    it('handlePointerLeave forgets the pointer, so no card stays hovered once it leaves the canvas', () => {
        const { deps, cardLayer } = makeDeps()
        cardLayer.children.push(makeCard(0, 0))
        const interactions = createPointerInteractions(deps)
        interactions.handlePointerMove(makeEvent(50, 10))

        interactions.handlePointerLeave()

        expect(interactions.findHoveredCard()).toBeNull()
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
        overlay.findStackByNameButtonAtPoint.mockReturnValue(stack)
        const interactions = createPointerInteractions(deps)

        interactions.handleNameButtonPointerDown(makeEvent(0, 0))

        expect(overlay.openNameEditor).not.toHaveBeenCalled()
    })

    it('handleNameButtonPointerDown no-ops when the overlay finds no rename button at the point', () => {
        const stack = [makeCard(100, 100)]
        const { deps, overlay } = makeDeps({ getStacks: (): Card[][] => [stack] })
        const interactions = createPointerInteractions(deps)

        interactions.handleNameButtonPointerDown(makeEvent(-9999, -9999))

        expect(overlay.findStackByNameButtonAtPoint).toHaveBeenCalledWith({ x: -9999, y: -9999 })
        expect(overlay.openNameEditor).not.toHaveBeenCalled()
    })

    it('handleNameButtonPointerDown opens the name editor over the stack whose rename button was hit, prefilled with its name', () => {
        const anchor = makeCard(100, 100, 200, 300, 'card-a')
        const stack = [anchor]
        const cardLayer = { children: [anchor] }
        const { deps, overlay, actionHistory } = makeDeps({
            getStacks: (): Card[][] => [stack],
            getStackNames: (): Record<string, string> => ({ 'card-a': 'Joie' }),
            cardLayer: cardLayer as unknown as PointerInteractionsDeps['cardLayer'],
        })
        overlay.findStackByNameButtonAtPoint.mockReturnValue(stack)
        const interactions = createPointerInteractions(deps)

        interactions.handleNameButtonPointerDown(makeEvent(0, 0))

        expect(overlay.commitNameEditorIfOpen).toHaveBeenCalledTimes(1)
        expect(actionHistory.captureBefore).toHaveBeenCalledWith([], { 'card-a': 'Joie' })
        expect(overlay.openNameEditor).toHaveBeenCalledTimes(1)
        const call = overlay.openNameEditor.mock.calls[0]
        expect(call[0]).toBe(stack)
        expect(call[1]).toBe('Joie')
    })

    it('handleNameButtonPointerDown wires its commit callback to onCommitStackName with the anchor card', () => {
        const anchor = makeCard(100, 100, 200, 300, 'card-a')
        const stack = [anchor]
        const cardLayer = { children: [anchor] }
        const { deps, overlay } = makeDeps({
            getStacks: (): Card[][] => [stack],
            cardLayer: cardLayer as unknown as PointerInteractionsDeps['cardLayer'],
        })
        overlay.findStackByNameButtonAtPoint.mockReturnValue(stack)
        const interactions = createPointerInteractions(deps)

        interactions.handleNameButtonPointerDown(makeEvent(0, 0))

        const onCommit = overlay.openNameEditor.mock.calls[0][2] as (value: string) => void
        onCommit('Colère')
        expect(deps.onCommitStackName).toHaveBeenCalledWith(anchor, 'Colère')

        const onCancel = overlay.openNameEditor.mock.calls[0][3] as () => void
        onCancel()
        expect(deps.onCancelStackNameEdit).toHaveBeenCalledTimes(1)
    })
})

