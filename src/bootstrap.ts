import { CanvasController } from './controllers/canvas-controller'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY } from './types/card-state.types'
import { CardStateService } from './services/card-state-service'
import { Store } from './services/store'
import { createOnboarding } from './ui/onboarding'
import type { Spritesheet } from 'pixi.js'

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
