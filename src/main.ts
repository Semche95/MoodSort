import './style.css'
import { createLoadingOverlay, createHeader, setupCanvas, initOnboarding, initToolbar } from './utils/canvas'
import { CanvasController } from './controllers/CanvasController'
import { Store } from './services/Store'
import { CardStateService } from './services/CardStateService'

(async (): Promise<void> => {
    const overlay: HTMLDivElement = createLoadingOverlay()
    document.body.appendChild(overlay)

    const store: CardStateService = new CardStateService(new Store())

    const images: string[] = Object.values(import.meta.glob<string>('./cards/*.webp', {
        query: '?url',
        import: 'default',
        eager: true,
    }))

    const { controller }: { controller: CanvasController } = await setupCanvas(images, store)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    createHeader()

    initOnboarding(store)
    initToolbar(controller, store)
})()
