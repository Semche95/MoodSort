import { CardStateService } from '../card/card-state-service'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY, STACK_NAMES_KEY, VIEWPORT_KEY } from '../../types/card-state.types'
import { I18n } from '../../i18n/I18n'
import { domIcon } from '../../shared/ui/dom-icons'
import { iconBadge, modalCloseButton } from '../../shared/ui/modal'
import logoUrl from '../../logo/logo.svg?url'

const STEPS = [
    ['rectangle-vertical', 'onboarding.step1'],
    ['move', 'onboarding.step2'],
    ['layers', 'onboarding.step3'],
    ['undo-2', 'onboarding.step4'],
    ['save', 'onboarding.step5'],
    ['screen-share', 'onboarding.step6'],
] as const

export function isOnboardingDismissed(store: CardStateService): boolean {
    return store.load(ONBOARDING_KEY)
}

function dismissOnboarding(store: CardStateService): void {
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
    overlay.className = 'modal-overlay onboarding-overlay'

    overlay.innerHTML = `
        <div class="modal onboarding-card">
            ${onboardingContent()}
            <button class="button button-primary button-block onboarding-dismiss">${I18n.t('onboarding.dismissButton')}</button>
        </div>
    `

    const btn = overlay.querySelector<HTMLButtonElement>('.onboarding-dismiss')!
    btn.addEventListener('click', (): void => {
        onDismiss()
        overlay.remove()
    })

    return overlay
}

/** Same content as the onboarding, reopened on demand, so it closes like the other modals. */
export function createHelpModal(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay onboarding-overlay'

    overlay.innerHTML = `
        <div class="modal onboarding-card">
            ${modalCloseButton('onboarding-close', I18n.t('onboarding.closeAriaLabel'))}
            ${onboardingContent()}
        </div>
    `

    const closeBtn = overlay.querySelector<HTMLButtonElement>('.onboarding-close')!
    closeBtn.addEventListener('click', (): void => {
        overlay.remove()
    })

    overlay.addEventListener('click', (e: MouseEvent): void => {
        if (e.target === overlay) {
            overlay.remove()
        }
    })

    return overlay
}

function onboardingContent(): string {
    return `
        <div class="onboarding-hero">
            <img class="onboarding-logo" src="${logoUrl}" alt="">
            <h1>${I18n.t('onboarding.title', { brand: '<span class="brand-accent">Mood</span>Sort' })}</h1>
            <p>${I18n.t('onboarding.intro')}</p>
        </div>
        <h2 class="visually-hidden">${I18n.t('onboarding.howItWorksTitle')}</h2>
        <ul class="onboarding-steps">
            ${STEPS.map(([icon, key]: (typeof STEPS)[number]): string => `<li>${iconBadge(icon)}<span>${I18n.t(key)}</span></li>`).join('')}
        </ul>
        <p class="onboarding-outro">${I18n.t('onboarding.outro')}</p>
        <p class="callout callout-info">${domIcon('lock')}<span>${I18n.t('onboarding.privacy')}</span></p>
    `
}
