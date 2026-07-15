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

export function createHelpButton(onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'help-button'
    btn.textContent = '?'
    btn.title = 'Afficher l\'aide'
    btn.addEventListener('click', onClick)
    return btn
}
