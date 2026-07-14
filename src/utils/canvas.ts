import { CanvasController } from '../controllers/CanvasController'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY } from '../types/card.types'
import { CardStateService } from '../services/CardStateService'
import { createOnboarding, createHelpButton } from '../ui/onboarding'
import { createSettingsButton, createSettingsModal } from '../ui/settings'

export function createLoadingOverlay(): HTMLDivElement {
    const overlay: HTMLDivElement = document.createElement('div')
    overlay.className = 'loading-overlay'

    const content: HTMLDivElement = document.createElement('div')
    content.className = 'loading-content'

    const spinner: HTMLDivElement = document.createElement('div')
    spinner.className = 'loading-spinner'

    const text: HTMLDivElement = document.createElement('div')
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
export async function setupCanvas(images: string[], store: CardStateService): Promise<{ controller: CanvasController }> {
    const controller: CanvasController = new CanvasController(store)
    await controller.init(images)
    return { controller }
}

export function createHeader(): void {
    const header: HTMLDivElement = document.createElement('div')
    header.className = 'app-header'

    const logo: HTMLSpanElement = document.createElement('span')
    logo.className = 'app-header-logo'
    logo.textContent = '🎭'

    const title: HTMLSpanElement = document.createElement('span')
    title.className = 'app-header-title'
    title.textContent = 'MoodSort'

    header.appendChild(logo)
    header.appendChild(title)
    document.body.appendChild(header)
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
    const showOnboarding: () => void = (): void => {
        const existing: Element | null = document.querySelector('.onboarding-overlay')
        if (existing) return
        document.body.appendChild(createOnboarding((): void => { dismissOnboarding(store) }))
    }

    if (!isOnboardingDismissed(store)) {
        showOnboarding()
    }
}

export function initToolbar(controller: CanvasController, store: CardStateService): void {
    const showOnboarding: () => void = (): void => {
        const existing: Element | null = document.querySelector('.onboarding-overlay')
        if (existing) return
        document.body.appendChild(createOnboarding((): void => { dismissOnboarding(store) }))
    }

    const openSettings: () => void = (): void => {
        const existing: Element | null = document.querySelector('.settings-overlay')
        if (existing) return
        document.body.appendChild(createSettingsModal({
            onResetPositions: (): void => {
                controller.resetPositions()
            },
        }))
    }

    const toolbar: HTMLDivElement = document.createElement('div')
    toolbar.className = 'toolbar'
    toolbar.appendChild(createHelpButton(showOnboarding))
    toolbar.appendChild(createSettingsButton(openSettings))
    document.body.appendChild(toolbar)
}
