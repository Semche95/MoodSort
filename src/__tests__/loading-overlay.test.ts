import { describe, expect, it } from 'vitest'
import { createLoadingOverlay } from '../shared/ui/loading-overlay'

describe('createLoadingOverlay', () => {
    it('builds an overlay containing a spinner and a loading message', () => {
        const overlay = createLoadingOverlay()

        expect(overlay.className).toBe('loading-overlay')
        const spinner = overlay.querySelector('.loading-spinner')
        expect(spinner).not.toBeNull()
        expect(overlay.textContent).toContain('Chargement')
    })
})
