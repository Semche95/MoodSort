import { CardStateService } from '../card/card-state-service'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY, STACK_NAMES_KEY, VIEWPORT_KEY } from '../../types/card-state.types'
import { I18n } from '../../i18n/I18n'

export function isOnboardingDismissed(store: CardStateService): boolean {
    return store.load(ONBOARDING_KEY)
}

export function dismissOnboarding(store: CardStateService): void {
    store.save({
        positions: store.load(POSITIONS_KEY),
        order: store.load(ORDER_KEY),
        onboardingDismissed: true,
        stackNames: store.load(STACK_NAMES_KEY),
        viewport: store.load(VIEWPORT_KEY),
    })
}

/** `onFirstDismiss` runs when a first-time visitor closes the onboarding, never on later visits. */
export function initOnboarding(store: CardStateService, onFirstDismiss: () => void): void {
    if (isOnboardingDismissed(store) || document.querySelector('.onboarding-overlay')) {
        return
    }
    document.body.appendChild(createOnboarding((): void => {
        dismissOnboarding(store)
        onFirstDismiss()
    }))
}

export function createOnboarding(onDismiss: () => void): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'onboarding-overlay'

    overlay.innerHTML = `
        <div class="onboarding-card">
            <h1>${I18n.t('onboarding.title')}</h1>
            <p>
                ${I18n.t('onboarding.intro')}
            </p>
            <h2>${I18n.t('onboarding.howItWorksTitle')}</h2>
            <ul>
                <li>${I18n.t('onboarding.step1')}</li>
                <li>${I18n.t('onboarding.step2')}</li>
                <li>${I18n.t('onboarding.step3')}</li>
                <li>${I18n.t('onboarding.step4')}</li>
                <li>${I18n.t('onboarding.step5')}</li>
                <li>${I18n.t('onboarding.step6')}</li>
            </ul>
            <p>
                ${I18n.t('onboarding.outro')}
            </p>
            <p>
                ${I18n.t('onboarding.privacy')}
            </p>
            <button class="onboarding-dismiss">${I18n.t('onboarding.dismissButton')}</button>
        </div>
    `

    const btn = overlay.querySelector<HTMLButtonElement>('.onboarding-dismiss')!
    btn.addEventListener('click', (): void => {
        onDismiss()
        overlay.remove()
    })

    return overlay
}
