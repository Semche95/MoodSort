import './style.css'
import { createLoadingOverlay, setupCanvas } from './utils/canvas'
import { DeckViewerController } from './controllers/DeckViewerController'
import type { DeckViewerOpenDetail } from './types/viewer.types'

(async (): Promise<void> => {
    const overlay: HTMLDivElement = createLoadingOverlay()
    document.body.appendChild(overlay)

    const images: string[] = Object.values(import.meta.glob<string>('./cards/*.png', {
        query: '?url',
        import: 'default',
        eager: true,
    }))

    const { onCanvasResize }: { onCanvasResize: () => void } = await setupCanvas(images)

    const deckViewer: DeckViewerController = new DeckViewerController()

    // Remove loading overlay once everything is ready and displayed
    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    // Global event listeners must be centralized and registered inside this async block per project guidelines
    window.addEventListener('resize', () => deckViewer.onResize())
    window.addEventListener('resize', onCanvasResize)
    window.addEventListener('keydown', (e: KeyboardEvent) => deckViewer.onKeydown(e))

    // Bridge: when drag.ts requests to open the viewer, forward to controller
    function onDeckViewerRequestOpen(evt: Event): void {
        const e: CustomEvent<DeckViewerOpenDetail> = evt as CustomEvent<DeckViewerOpenDetail>
        const detail: DeckViewerOpenDetail = e.detail
        if (!detail) {
            return
        }
        deckViewer.open(detail.cards)
    }
    document.addEventListener('deckviewer:requestOpen', onDeckViewerRequestOpen)
})()
