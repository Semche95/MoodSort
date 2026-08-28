import { CanvasController } from '../controllers/CanvasController'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY } from '../types/card.types'
import { CardStateService } from '../services/CardStateService'
import { Store } from '../services/Store'
import { createOnboarding } from '../ui/onboarding'
import type { Spritesheet } from 'pixi.js'

export function createLoadingOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'loading-overlay'

    const content = document.createElement('div')
    content.className = 'loading-content'

    const spinner = document.createElement('div')
    spinner.className = 'loading-spinner'

    const text = document.createElement('div')
    text.textContent = 'Chargement…'

    content.appendChild(spinner)
    content.appendChild(text)
    overlay.appendChild(content)

    return overlay
}

/**
 * Sets up the canvas with the provided images
 * @param images - Array of image paths to load
 * @param store - Shared store instance
 * @returns Promise that resolves with the controller
 * @throws Error if no images are provided
 */
export async function setupCanvas(frameNames: string[], spritesheet: Spritesheet, store: CardStateService): Promise<{ controller: CanvasController }> {
    const historyStore = new Store()
    const controller = new CanvasController(store, historyStore)
    await controller.init(frameNames, spritesheet)
    return { controller }
}

export function isOnboardingDismissed(store: CardStateService): boolean {
    return store.load(ONBOARDING_KEY)
}

export function dismissOnboarding(store: CardStateService): void {
    store.save({
        positions: store.load(POSITIONS_KEY),
        order: store.load(ORDER_KEY),
        onboardingDismissed: true,
    })
}

export function initOnboarding(store: CardStateService): void {
    const showOnboarding = (): void => {
        const existing = document.querySelector('.onboarding-overlay')
        if (existing) return
        document.body.appendChild(createOnboarding((): void => { dismissOnboarding(store) }))
    }

    if (!isOnboardingDismissed(store)) {
        showOnboarding()
    }
}

export function initHistoryShortcuts(doUndo: () => void, doRedo: () => void): void {
    const mod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey

    window.addEventListener('keydown', (e: KeyboardEvent): void => {
        if (!mod(e)) return
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault()
            doUndo()
        } else if (e.key.toLowerCase() === 'z' && e.shiftKey) {
            e.preventDefault()
            doRedo()
        } else if (e.key === 'y') {
            e.preventDefault()
            doRedo()
        }
    })
}
