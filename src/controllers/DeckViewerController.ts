import { Card } from '../types/card.types'
import { DeckViewerDropDetail, DeckViewerHoverDetail } from '../types/viewer.types'

const OVERLAY_ID: string = 'deck-viewer-overlay'
const GRID_ID: string = 'deck-viewer-grid'
const MODAL_ID: string = 'deck-viewer-modal'
const HEADER_ID: string = 'deck-viewer-header'

const DROP_EVENT_NAME: string = 'deckviewer:drop'
const HOVER_EVENT_NAME: string = 'deckviewer:hover'
const END_EVENT_NAME: string = 'deckviewer:end'

interface DragContext {
    card: Card
    img: HTMLImageElement
    isDown: boolean
    downX: number
    downY: number
    ghostEl: HTMLImageElement | null
    onDocMouseUp: ((e: MouseEvent) => void) | null
    onDocMouseMove: ((e: MouseEvent) => void) | null
}

interface ModalDragState { isDown: boolean, offsetX: number, offsetY: number }

export class DeckViewerController {
    private cards: Card[]

    constructor() {
        this.cards = []
    }

    open(cards: Card[]): void {
        if (cards.length === 0) {
            return
        }
        this.cards = cards
        this.ensureOverlay()
        this.render()
    }

    close(): void {
        const overlay: HTMLElement | null = document.getElementById(OVERLAY_ID)
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay)
        }
        // Notify listeners that the viewer closed
        document.dispatchEvent(new CustomEvent('deckviewer:closed'))
        // Clear state
        this.cards = []
    }

    onResize(): void {
        if (!this.hasOverlay()) {
            return
        }
        // Re-render to recompute grid cell width, etc.
        this.render()
    }

    onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.hasOverlay()) {
            this.close()
        }
    }

    // ===== private helpers =====

    private hasOverlay(): boolean {
        return !!document.getElementById(OVERLAY_ID)
    }

    private getGridElement(): HTMLDivElement | null {
        return document.getElementById(GRID_ID) as HTMLDivElement | null
    }

    private setGridCellWidth(gridEl: HTMLDivElement): void {
        if (this.cards.length === 0) {
            return
        }
        const cellW: number = Math.max(1, Math.round(this.cards[0].width))
        gridEl.style.setProperty('--cell-w', `${cellW}px`)
    }

    private clearGrid(gridEl: HTMLDivElement): void {
        gridEl.innerHTML = ''
    }

    private createGridItem(card: Card, index: number): HTMLImageElement {
        const img: HTMLImageElement = document.createElement('img')
        img.src = card.imageUrl ?? ''
        img.alt = `Carte ${index + 1}`
        img.className = 'deck-viewer-grid-item'
        return img
    }

    private dispatchHoverForCard(card: Card, clientX: number, clientY: number): void {
        const detail: DeckViewerHoverDetail = {
            x: clientX,
            y: clientY,
            width: Math.round(card.width),
            height: Math.round(card.height),
        }
        const evt: CustomEvent<DeckViewerHoverDetail> = new CustomEvent<DeckViewerHoverDetail>(HOVER_EVENT_NAME, { detail })
        document.dispatchEvent(evt)
    }

    private dispatchEndEvent(): void {
        const evt: CustomEvent<void> = new CustomEvent<void>(END_EVENT_NAME)
        document.dispatchEvent(evt)
    }

    private createGhostForCard(card: Card, alt: string): HTMLImageElement {
        const ghost: HTMLImageElement = document.createElement('img')
        ghost.src = card.imageUrl ?? ''
        ghost.alt = alt
        ghost.className = 'deck-viewer-drag-ghost'
        ghost.style.width = `${Math.round(card.width)}px`
        ghost.style.height = 'auto'
        document.body.appendChild(ghost)
        return ghost
    }

    private positionGhostEl(ghostEl: HTMLImageElement | null, clientX: number, clientY: number): void {
        if (!ghostEl) {
            return
        }
        const rect: DOMRect = ghostEl.getBoundingClientRect()
        const halfW: number = rect.width / 2
        const halfH: number = rect.height / 2
        ghostEl.style.left = `${clientX - halfW}px`
        ghostEl.style.top = `${clientY - halfH}px`
    }

    private removeGhostEl(ghostEl: HTMLImageElement | null): void {
        if (ghostEl && ghostEl.parentElement) {
            ghostEl.parentElement.removeChild(ghostEl)
        }
    }

    private isInsideViewerAt(clientX: number, clientY: number): boolean {
        const el: HTMLElement | null = document.elementFromPoint(clientX, clientY) as HTMLElement | null
        return !!el && !!el.closest('.deck-viewer-modal')
    }

    private handleMouseUp(e: MouseEvent, ctx: DragContext): void {
        if (ctx.onDocMouseUp) {
            document.removeEventListener('mouseup', ctx.onDocMouseUp)
            ctx.onDocMouseUp = null
        }
        if (ctx.onDocMouseMove) {
            document.removeEventListener('mousemove', ctx.onDocMouseMove)
            ctx.onDocMouseMove = null
        }

        if (!ctx.isDown) {
            this.removeGhostEl(ctx.ghostEl)
            this.dispatchEndEvent()
            return
        }

        ctx.isDown = false
        ctx.img.style.cursor = 'default'

        const dx: number = e.clientX - ctx.downX
        const dy: number = e.clientY - ctx.downY
        const movedEnough: boolean = Math.hypot(dx, dy) > 5

        if (this.isInsideViewerAt(e.clientX, e.clientY)) {
            this.removeGhostEl(ctx.ghostEl)
            this.dispatchEndEvent()
            return
        }

        if (movedEnough) {
            const detail: DeckViewerDropDetail = { card: ctx.card, x: e.clientX, y: e.clientY }
            const customEvent: CustomEvent<DeckViewerDropDetail> = new CustomEvent<DeckViewerDropDetail>(DROP_EVENT_NAME, { detail })
            document.dispatchEvent(customEvent)
            this.close()
        }
        this.removeGhostEl(ctx.ghostEl)
        this.dispatchEndEvent()
    }

    private startDrag(e: MouseEvent, ctx: DragContext): void {
        e.preventDefault()
        e.stopPropagation()

        ctx.isDown = true
        ctx.downX = e.clientX
        ctx.downY = e.clientY
        ctx.img.style.cursor = 'grabbing'

        ctx.ghostEl = this.createGhostForCard(ctx.card, ctx.img.alt)
        this.positionGhostEl(ctx.ghostEl, e.clientX, e.clientY)
        this.dispatchHoverForCard(ctx.card, e.clientX, e.clientY)

        ctx.onDocMouseMove = (mv: MouseEvent): void => {
            this.positionGhostEl(ctx.ghostEl, mv.clientX, mv.clientY)
            this.dispatchHoverForCard(ctx.card, mv.clientX, mv.clientY)
        }
        document.addEventListener('mousemove', ctx.onDocMouseMove)

        ctx.onDocMouseUp = (up: MouseEvent): void => {
            up.preventDefault()
            this.handleMouseUp(up, ctx)
        }
        document.addEventListener('mouseup', ctx.onDocMouseUp)
    }

    private attachDragBridge(img: HTMLImageElement, card: Card): void {
        const ctx: DragContext = {
            card,
            img,
            isDown: false,
            downX: 0,
            downY: 0,
            ghostEl: null,
            onDocMouseUp: null,
            onDocMouseMove: null,
        }

        img.addEventListener('mousedown', (e: MouseEvent) => this.startDrag(e, ctx))
        img.addEventListener('mouseup', (e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            this.handleMouseUp(e, ctx)
        })
    }

    private renderGrid(gridEl: HTMLDivElement): void {
        this.clearGrid(gridEl)
        for (let i: number = 0; i < this.cards.length; i++) {
            const c: Card = this.cards[i]
            const img: HTMLImageElement = this.createGridItem(c, i)
            this.attachDragBridge(img, c)
            gridEl.appendChild(img)
            // Re-center modal when each image loads, to account for layout growth
            const recenter: () => void = (): void => {
                const modal: HTMLDivElement | null = document.getElementById(MODAL_ID) as HTMLDivElement | null
                if (modal) {
                    this.centerModal(modal)
                }
            }
            img.addEventListener('load', recenter)
            // If the image was loaded from cache, load may not fire; re-center immediately
            if (img.complete) {
                recenter()
            }
        }
    }

    private centerModal(modal: HTMLDivElement): void {
        const vw: number = window.innerWidth
        const vh: number = window.innerHeight
        modal.style.left = '0px'
        modal.style.top = '0px'
        const rect: DOMRect = modal.getBoundingClientRect()
        const x: number = Math.max(0, Math.round((vw - rect.width) / 2))
        const y: number = Math.max(0, Math.round((vh - rect.height) / 2))
        modal.style.left = `${x}px`
        modal.style.top = `${y}px`
    }

    private handleModalHeaderMouseDown(e: MouseEvent, modal: HTMLDivElement, drag: ModalDragState, onMove: (e: MouseEvent) => void, end: () => void): void {
        e.preventDefault()
        const rect: DOMRect = modal.getBoundingClientRect()
        drag.offsetX = e.clientX - rect.left
        drag.offsetY = e.clientY - rect.top
        drag.isDown = true
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', end)
    }

    private makeModalDraggable(modal: HTMLDivElement, header: HTMLDivElement): void {
        const drag: ModalDragState = { isDown: false, offsetX: 0, offsetY: 0 }

        const onMove: (e: MouseEvent) => void = (e: MouseEvent): void => {
            if (!drag.isDown) {
                return
            }
            const nx: number = e.clientX - drag.offsetX
            const ny: number = e.clientY - drag.offsetY
            modal.style.left = `${nx}px`
            modal.style.top = `${ny}px`
        }

        const end: () => void = (): void => {
            if (!drag.isDown) {
                return
            }
            drag.isDown = false
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', end)
        }

        header.addEventListener('mousedown', (e: MouseEvent) => this.handleModalHeaderMouseDown(e, modal, drag, onMove, end))
    }

    private ensureOverlay(): void {
        let overlay: HTMLElement | null = document.getElementById(OVERLAY_ID)
        if (overlay) {
            return
        }

        overlay = document.createElement('div')
        overlay.id = OVERLAY_ID
        overlay.className = 'deck-viewer-overlay'

        const onOverlayBackdropClick: (e: MouseEvent) => void = (e: MouseEvent): void => {
            const target: HTMLElement | null = e.target as HTMLElement | null
            const current: HTMLElement | null = e.currentTarget as HTMLElement | null
            if (current && target === current) {
                this.close()
            }
        }
        overlay.addEventListener('click', onOverlayBackdropClick)

        const modal: HTMLDivElement = document.createElement('div')
        modal.className = 'deck-viewer-modal'
        modal.id = MODAL_ID

        const header: HTMLDivElement = document.createElement('div')
        header.id = HEADER_ID
        header.className = 'deck-viewer-header'
        const title: HTMLDivElement = document.createElement('div')
        title.textContent = 'Deck Viewer'
        title.className = 'deck-viewer-title'
        const closeBtn: HTMLButtonElement = document.createElement('button')
        closeBtn.className = 'deck-viewer-close'
        closeBtn.textContent = '×'
        closeBtn.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation()
            this.close()
        })
        header.appendChild(title)
        header.appendChild(closeBtn)

        const grid: HTMLDivElement = document.createElement('div')
        grid.id = GRID_ID
        grid.className = 'deck-viewer-grid'

        modal.appendChild(header)
        modal.appendChild(grid)

        overlay.appendChild(modal)

        modal.style.position = 'fixed'
        modal.style.zIndex = '10001'
        this.centerModal(modal)
        this.makeModalDraggable(modal, header)

        document.body.appendChild(overlay)
    }

    private render(): void {
        const gridEl: HTMLDivElement | null = this.getGridElement()
        if (!gridEl) {
            return
        }
        this.setGridCellWidth(gridEl)
        this.renderGrid(gridEl)
        const modal: HTMLDivElement | null = document.getElementById(MODAL_ID) as HTMLDivElement | null
        if (modal) {
            this.centerModal(modal)
        }
    }
}
