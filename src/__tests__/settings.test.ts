import { describe, expect, it, vi } from 'vitest'
import { createSettingsModal } from '../features/settings/settings'
import { ThemeService } from '../features/theme/theme-service'
import { InMemoryStore } from './in-memory-store'

function createModal(theme: 'light' | 'dark' | 'auto' = 'auto', onResetPositions: () => void = vi.fn()): { overlay: HTMLDivElement; themeService: ThemeService } {
    const themeService = new ThemeService(new InMemoryStore())
    themeService.setTheme(theme)
    const overlay = createSettingsModal({ onResetPositions, themeService })
    return { overlay, themeService }
}

describe('createSettingsModal theme toggle', () => {
    it('renders exactly 3 theme segments', () => {
        const { overlay } = createModal()

        const options = overlay.querySelectorAll('.settings-theme-option')

        expect(options.length).toBe(3)
    })

    it('reflects the current theme as active when the modal opens', () => {
        const { overlay } = createModal('dark')

        const active = overlay.querySelector<HTMLButtonElement>('.settings-theme-option.active')

        expect(active?.dataset.theme).toBe('dark')
    })

    it('calls themeService.setTheme with the clicked segment value and updates the active state', () => {
        const { overlay, themeService } = createModal('auto')
        const setThemeSpy = vi.spyOn(themeService, 'setTheme')

        const lightButton = overlay.querySelector<HTMLButtonElement>('[data-theme="light"]')!
        lightButton.click()

        expect(setThemeSpy).toHaveBeenCalledWith('light')
        expect(lightButton.classList.contains('active')).toBe(true)
    })

    it('calls themeService.setTheme for each of the 3 segments', () => {
        const { overlay, themeService } = createModal('auto')
        const setThemeSpy = vi.spyOn(themeService, 'setTheme')

        for (const theme of ['light', 'dark', 'auto'] as const) {
            overlay.querySelector<HTMLButtonElement>(`[data-theme="${theme}"]`)!.click()
            expect(setThemeSpy).toHaveBeenCalledWith(theme)
        }
    })
})

describe('createSettingsModal reset confirmation', () => {
    it('replaces the reset row with the confirmation until it is cancelled', () => {
        const onResetPositions = vi.fn()
        const { overlay } = createModal('auto', onResetPositions)
        const row = overlay.querySelector<HTMLElement>('.settings-row')!

        overlay.querySelector<HTMLButtonElement>('.settings-reset-positions')!.click()

        expect(row.hidden).toBe(true)
        expect(overlay.querySelectorAll('.settings-confirm')).toHaveLength(1)

        overlay.querySelector<HTMLButtonElement>('.settings-confirm-cancel')!.click()

        expect(row.hidden).toBe(false)
        expect(overlay.querySelector('.settings-confirm')).toBeNull()
        expect(onResetPositions).not.toHaveBeenCalled()
    })

    it('resets the positions and closes the modal once confirmed', () => {
        const onResetPositions = vi.fn()
        const { overlay } = createModal('auto', onResetPositions)
        document.body.appendChild(overlay)

        overlay.querySelector<HTMLButtonElement>('.settings-reset-positions')!.click()
        overlay.querySelector<HTMLButtonElement>('.settings-confirm-ok')!.click()

        expect(onResetPositions).toHaveBeenCalledOnce()
        expect(overlay.isConnected).toBe(false)
    })
})
