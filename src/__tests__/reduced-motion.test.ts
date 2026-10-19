import { describe, it, expect, vi, afterEach } from 'vitest'
import { prefersReducedMotion } from '../shared/utils/reduced-motion'

describe('prefersReducedMotion', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('follows the prefers-reduced-motion media query', () => {
        const matchMedia = vi.fn().mockReturnValue({ matches: true })
        vi.stubGlobal('matchMedia', matchMedia)

        expect(prefersReducedMotion()).toBe(true)
        expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    })

    it('assumes motion is fine when matchMedia is unavailable', () => {
        vi.stubGlobal('matchMedia', undefined)

        expect(prefersReducedMotion()).toBe(false)
    })
})
