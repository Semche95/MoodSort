import { I18n } from '../../i18n/I18n'

export function createSettingsModal(options: {
    onResetPositions: () => void
}): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'settings-overlay'

    const modal = document.createElement('div')
    modal.className = 'settings-modal'

    modal.innerHTML = `
        <div class="settings-header">
            <h1>${I18n.t('settings.title')}</h1>
            <button class="settings-close" aria-label="${I18n.t('settings.closeAriaLabel')}">&times;</button>
        </div>
        <div class="settings-body">
            <section class="settings-section">
                <h2>${I18n.t('settings.cardsSection')}</h2>
                <p>${I18n.t('settings.resetPositionsDescription')}</p>
                <button class="settings-reset-positions">${I18n.t('settings.resetPositionsButton')}</button>
            </section>
        </div>
    `

    const closeBtn = modal.querySelector<HTMLButtonElement>('.settings-close')!
    closeBtn.addEventListener('click', (): void => {
        overlay.remove()
    })

    overlay.addEventListener('click', (e: MouseEvent): void => {
        if (e.target === overlay) {
            overlay.remove()
        }
    })

    const resetBtn = modal.querySelector<HTMLButtonElement>('.settings-reset-positions')!
    resetBtn.addEventListener('click', (): void => {
        showConfirmation(modal, I18n.t('settings.confirmResetTitle'), I18n.t('settings.confirmResetMessage'), (): void => {
            options.onResetPositions()
            overlay.remove()
        })
    })

    overlay.appendChild(modal)
    return overlay
}

function showConfirmation(
    parent: HTMLDivElement,
    title: string,
    message: string,
    onConfirm: () => void,
): void {
    const confirm = document.createElement('div')
    confirm.className = 'settings-confirm'

    confirm.innerHTML = `
        <p><strong>${title}</strong></p>
        <p>${message}</p>
        <div class="settings-confirm-actions">
            <button class="settings-confirm-cancel">${I18n.t('settings.confirmCancel')}</button>
            <button class="settings-confirm-ok">${I18n.t('settings.confirmOk')}</button>
        </div>
    `

    const cancelBtn = confirm.querySelector<HTMLButtonElement>('.settings-confirm-cancel')!
    cancelBtn.addEventListener('click', (): void => {
        confirm.remove()
    })

    const okBtn = confirm.querySelector<HTMLButtonElement>('.settings-confirm-ok')!
    okBtn.addEventListener('click', (): void => {
        confirm.remove()
        onConfirm()
    })

    parent.appendChild(confirm)
}
