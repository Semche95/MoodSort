import type { FancyButton } from '@pixi/ui'
import type { Texture } from 'pixi.js'
import type { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { createIcon } from '../../shared/ui/icons'
import type { Locale } from '../../i18n/i18n.types'
import { AVAILABLE_LOCALES } from '../../i18n/locales'
import { BUTTON_SIZE, createButton } from './toolbar-view'

function ariaLabel(locale: Locale): string {
    return locale === 'fr' ? 'Changer de langue' : 'Change language'
}

function createNativeSelect(currentLocale: Locale, onSelect: (locale: Locale) => void): HTMLSelectElement {
    const select = document.createElement('select')
    select.className = 'toolbar-locale-select'
    select.setAttribute('aria-label', ariaLabel(currentLocale))
    select.style.position = 'fixed'
    select.style.opacity = '0'
    select.style.margin = '0'
    select.style.padding = '0'
    select.style.border = 'none'
    select.style.pointerEvents = 'none'
    select.style.zIndex = '1000'

    for (const option of AVAILABLE_LOCALES) {
        const element = document.createElement('option')
        element.value = option.code
        element.textContent = option.nativeName
        select.appendChild(element)
    }
    select.value = currentLocale

    select.addEventListener('change', (): void => {
        onSelect(select.value as Locale)
    })

    return select
}

export interface LocaleMenu {
    button: FancyButton
    select: HTMLSelectElement
    /** Recalculates the invisible native select's screen position to match the Pixi button's, given the current canvas placement. */
    updatePosition(canvasElement: HTMLCanvasElement): void
}

/**
 * Round toolbar button showing a globe icon, matching the other controls'
 * style. The actual language picking isn't done in Pixi: an invisible
 * native `<select>` is kept stacked exactly on top of the button (see
 * `updatePosition`), so a click is really caught by the browser's own
 * picker. Its `onchange` calls `onSelect`.
 */
export function createLocaleMenu(tooltip: CanvasTooltip, globeIconTexture: Texture, currentLocale: Locale, onSelect: (locale: Locale) => void): LocaleMenu {
    const label = ariaLabel(currentLocale)
    const select = createNativeSelect(currentLocale, onSelect)
    document.body.appendChild(select)

    const button = createButton(tooltip, createIcon(globeIconTexture), (): void => {
        try {
            select.showPicker()
        } catch {
            select.click()
        }
    }, 'toolbar-localebutton', label)

    function updatePosition(canvasElement: HTMLCanvasElement): void {
        const rect = canvasElement.getBoundingClientRect()
        select.style.left = `${rect.left + button.x - BUTTON_SIZE / 2}px`
        select.style.top = `${rect.top + button.y - BUTTON_SIZE / 2}px`
        select.style.width = `${BUTTON_SIZE}px`
        select.style.height = `${BUTTON_SIZE}px`
    }

    return { button, select, updatePosition }
}
