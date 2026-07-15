import './style.css'
import { createLoadingOverlay, createHeader, setupCanvas, initOnboarding, initToolbar } from './utils/canvas'
import { CardStateService } from './services/CardStateService'

(async (): Promise<void> => {
    const overlay = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService = new CardStateService()

    const images = Object.values(import.meta.glob<string>('./cards/*.webp', {
        query: '?url',
        import: 'default',
        eager: true,
    }))

    const { controller } = await setupCanvas(images, cardStateService)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    createHeader()

    initOnboarding(cardStateService)
    initToolbar(controller, cardStateService)
})()
