import { describe, expect, it, vi } from 'vitest'
import { createSettingsModal } from '../features/settings/settings'
import { ThemeService } from '../features/theme/theme-service'
import { InMemoryStore } from './in-memory-store'

function createModal(theme: 'light' | 'dark' | 'auto' = 'auto'): { overlay: HTMLDivElement; themeService: ThemeService } {
    const themeService = new ThemeService(new InMemoryStore())
    themeService.setTheme(theme)
    const overlay = createSettingsModal({ onResetPositions: vi.fn(), themeService })
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
