import { CardStateService } from '../card/card-state-service'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY, STACK_NAMES_KEY } from '../../types/card-state.types'
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
