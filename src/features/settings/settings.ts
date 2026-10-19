import { I18n } from '../../i18n/I18n'
import { ThemeService } from '../theme/theme-service'
import { Theme } from '../../types/theme.types'
import { domIcon } from '../../shared/ui/dom-icons'
import { modalCloseButton } from '../../shared/ui/modal'

export function createSettingsModal(options: {
    onResetPositions: () => void
    themeService: ThemeService
}): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay settings-overlay'

    const modal = document.createElement('div')
    modal.className = 'modal settings-modal'

    modal.innerHTML = `
        <div class="modal-header">
            <h1>${I18n.t('settings.title')}</h1>
            ${modalCloseButton('settings-close', I18n.t('settings.closeAriaLabel'))}
        </div>
        <div class="modal-body">
            <section class="settings-section">
                <h2>${I18n.t('settings.themeSection')}</h2>
                <div class="settings-theme-toggle" role="group">
                    <button class="settings-theme-option" data-theme="light">${domIcon('sun')}${I18n.t('settings.themeLight')}</button>
                    <button class="settings-theme-option" data-theme="dark">${domIcon('moon')}${I18n.t('settings.themeDark')}</button>
                    <button class="settings-theme-option" data-theme="auto">${domIcon('monitor')}${I18n.t('settings.themeAuto')}</button>
                </div>
            </section>
            <section class="settings-section">
                <h2>${I18n.t('settings.cardsSection')}</h2>
                <div class="settings-row">
                    <p>${I18n.t('settings.resetPositionsDescription')}</p>
                    <button class="button button-secondary settings-reset-positions">${domIcon('rotate-ccw')}${I18n.t('settings.resetPositionsButton')}</button>
                </div>
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

    const themeButtons = modal.querySelectorAll<HTMLButtonElement>('.settings-theme-option')
    setActiveThemeButton(themeButtons, options.themeService.getTheme())
    for (const button of themeButtons) {
        button.addEventListener('click', (): void => {
            const theme = button.dataset.theme as Theme
            options.themeService.setTheme(theme)
            setActiveThemeButton(themeButtons, theme)
        })
    }

    const resetBtn = modal.querySelector<HTMLButtonElement>('.settings-reset-positions')!
    resetBtn.addEventListener('click', (): void => {
        showConfirmation(modal.querySelector<HTMLElement>('.settings-row')!, I18n.t('settings.confirmResetTitle'), I18n.t('settings.confirmResetMessage'), (): void => {
            options.onResetPositions()
            overlay.remove()
        })
    })

    overlay.appendChild(modal)
    return overlay
}

function setActiveThemeButton(buttons: NodeListOf<HTMLButtonElement>, activeTheme: Theme): void {
    for (const button of buttons) {
        const isActive = button.dataset.theme === activeTheme
        button.classList.toggle('active', isActive)
        button.setAttribute('aria-pressed', String(isActive))
    }
}

/** Swaps `row` for the confirmation box until the user answers, so only one confirmation can be open at a time. */
function showConfirmation(
    row: HTMLElement,
    title: string,
    message: string,
    onConfirm: () => void,
): void {
    const confirm = document.createElement('div')
    confirm.className = 'settings-confirm'

    confirm.innerHTML = `
        ${domIcon('rotate-ccw')}
        <div class="settings-confirm-content">
            <strong>${title}</strong>
            <p>${message}</p>
            <div class="settings-confirm-actions">
                <button class="button button-secondary settings-confirm-cancel">${I18n.t('settings.confirmCancel')}</button>
                <button class="button button-danger settings-confirm-ok">${I18n.t('settings.confirmOk')}</button>
            </div>
        </div>
    `

    const close = (): void => {
        confirm.remove()
        row.hidden = false
    }

    const cancelBtn = confirm.querySelector<HTMLButtonElement>('.settings-confirm-cancel')!
    cancelBtn.addEventListener('click', close)

    const okBtn = confirm.querySelector<HTMLButtonElement>('.settings-confirm-ok')!
    okBtn.addEventListener('click', (): void => {
        close()
        onConfirm()
    })

    row.hidden = true
    row.after(confirm)
}
