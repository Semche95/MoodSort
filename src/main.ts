import './style.css'
import { createLoadingOverlay, createHeader, setupCanvas, initOnboarding, initToolbar } from './utils/canvas'
import { CanvasController } from './controllers/CanvasController'
import { CardStateService } from './services/CardStateService'

(async (): Promise<void> => {
    const overlay: HTMLDivElement = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService: CardStateService = new CardStateService()

    const images: string[] = Object.values(import.meta.glob<string>('./cards/*.webp', {
        query: '?url',
        import: 'default',
        eager: true,
    }))

    const { controller }: { controller: CanvasController } = await setupCanvas(images, cardStateService)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    createHeader()

    initOnboarding(cardStateService)
    initToolbar(controller, cardStateService)
})()
