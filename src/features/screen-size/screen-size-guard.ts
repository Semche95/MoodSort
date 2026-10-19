import { I18n } from '../../i18n/I18n'
import { iconBadge } from '../../shared/ui/modal'

export const MIN_SCREEN_WIDTH_PX = 1024

export function isScreenTooSmall(): boolean {
    return window.innerWidth < MIN_SCREEN_WIDTH_PX
}

export function createScreenSizeBlockOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay screen-size-overlay'

    const content = document.createElement('div')
    content.className = 'modal screen-size-content'
    content.innerHTML = `
        ${iconBadge('monitor')}
        <h1>${I18n.t('screenSize.title')}</h1>
        <p>${I18n.t('screenSize.message')}</p>
    `

    overlay.appendChild(content)

    return overlay
}

export function initScreenSizeGuard(overlay: HTMLDivElement, onScreenReady: () => void): void {
    let hasBecomeReady = false

    const applyScreenState = (): void => {
        const tooSmall = isScreenTooSmall()
        overlay.style.display = tooSmall ? 'flex' : 'none'
        if (!tooSmall && !hasBecomeReady) {
            hasBecomeReady = true
            onScreenReady()
        }
    }

    applyScreenState()
    window.addEventListener('resize', applyScreenState)
}
