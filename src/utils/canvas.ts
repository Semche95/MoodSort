import { CanvasController } from '../controllers/CanvasController'
import { OnboardingStore } from '../services/OnboardingStore'
import { PositionStore } from '../services/PositionStore'
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
 * @returns Promise that resolves with the controller
 * @throws Error if no images are provided
 */
export async function setupCanvas(images: string[]): Promise<{ controller: CanvasController }> {
    const controller: CanvasController = new CanvasController(new PositionStore())
    await controller.init(images)
    return { controller }
}

export function initOnboarding(store: OnboardingStore): void {
    const showOnboarding: () => void = (): void => {
        const existing: Element | null = document.querySelector('.onboarding-overlay')
        if (existing) return
        document.body.appendChild(createOnboarding(store))
    }

    if (!store.isDismissed()) {
        showOnboarding()
    }
}

export function initToolbar(controller: CanvasController, onboardingStore: OnboardingStore): void {
    const showOnboarding: () => void = (): void => {
        const existing: Element | null = document.querySelector('.onboarding-overlay')
        if (existing) return
        document.body.appendChild(createOnboarding(onboardingStore))
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
