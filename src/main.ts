import './style.css'
import { createLoadingOverlay, setupCanvas, initOnboarding, initToolbar } from './utils/canvas'
import { CanvasController } from './controllers/CanvasController'
import { OnboardingStore } from './services/OnboardingStore'

(async (): Promise<void> => {
    const overlay: HTMLDivElement = createLoadingOverlay()
    document.body.appendChild(overlay)

    const images: string[] = Object.values(import.meta.glob<string>('./cards/*.webp', {
        query: '?url',
        import: 'default',
        eager: true,
    })).reverse()

    const { controller }: { controller: CanvasController } = await setupCanvas(images)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    const onboardingStore: OnboardingStore = new OnboardingStore()
    initOnboarding(onboardingStore)
    initToolbar(controller, onboardingStore)
})()
