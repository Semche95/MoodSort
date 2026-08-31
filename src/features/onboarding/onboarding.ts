import { CardStateService } from '../card/card-state-service'
import { POSITIONS_KEY, ORDER_KEY, ONBOARDING_KEY, STACK_NAMES_KEY } from '../../types/card-state.types'

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
            <h1>Bienvenue sur MoodSort</h1>
            <p>
                MoodSort est un support visuel pour vous aider à explorer vos émotions.
            </p>
            <h2>Comment ça marche&nbsp;?</h2>
            <ul>
                <li>Chaque carte représente une émotion.</li>
                <li>Déplacez les cartes pour représenter ce qui vous correspond aujourd'hui.</li>
                <li>Votre disposition est sauvegardée automatiquement.</li>
            </ul>
            <p>
                Il n'y a pas de bonne ou de mauvaise façon de placer les cartes.
                Regroupez-les de la manière qui vous aide à explorer vos émotions.
            </p>
            <p>
                🔒 <strong>Vos données restent privées :</strong> tout ce que vous faites dans MoodSort
                reste sur votre appareil. Rien n'est envoyé ni stocké ailleurs.
            </p>
            <button class="onboarding-dismiss">Commencer</button>
        </div>
    `

    const btn = overlay.querySelector<HTMLButtonElement>('.onboarding-dismiss')!
    btn.addEventListener('click', (): void => {
        onDismiss()
        overlay.remove()
    })

    return overlay
}
