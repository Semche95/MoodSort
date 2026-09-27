import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
    MIN_SCREEN_WIDTH_PX,
    createScreenSizeBlockOverlay,
    initScreenSizeGuard,
    isScreenTooSmall,
} from '../features/screen-size/screen-size-guard'
import { I18n } from '../i18n/I18n'

function setInnerWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
}

describe('isScreenTooSmall', () => {
    afterEach(() => {
        setInnerWidth(1280)
    })

    it('returns true when the screen is narrower than the threshold', () => {
        setInnerWidth(MIN_SCREEN_WIDTH_PX - 1)

        expect(isScreenTooSmall()).toBe(true)
    })

    it('returns false when the screen is at or above the threshold', () => {
        setInnerWidth(MIN_SCREEN_WIDTH_PX)

        expect(isScreenTooSmall()).toBe(false)
    })
})

describe('createScreenSizeBlockOverlay', () => {
    it('builds an overlay with the expected class and translated message', () => {
        const overlay = createScreenSizeBlockOverlay()

        expect(overlay.className).toBe('screen-size-overlay')
        expect(overlay.textContent).toContain(I18n.t('screenSize.message'))
    })
})

describe('initScreenSizeGuard', () => {
    beforeEach(() => {
        setInnerWidth(1280)
    })

    afterEach(() => {
        setInnerWidth(1280)
    })

    it('shows the overlay and does not call onScreenReady when the screen starts too small', () => {
        setInnerWidth(MIN_SCREEN_WIDTH_PX - 1)
        const overlay = createScreenSizeBlockOverlay()
        const onScreenReady = vi.fn()

        initScreenSizeGuard(overlay, onScreenReady)

        expect(overlay.style.display).toBe('flex')
        expect(onScreenReady).not.toHaveBeenCalled()
    })

    it('hides the overlay and calls onScreenReady once when the width crosses above the threshold', () => {
        setInnerWidth(MIN_SCREEN_WIDTH_PX - 1)
        const overlay = createScreenSizeBlockOverlay()
        const onScreenReady = vi.fn()

        initScreenSizeGuard(overlay, onScreenReady)

        setInnerWidth(MIN_SCREEN_WIDTH_PX)
        window.dispatchEvent(new Event('resize'))

        expect(overlay.style.display).toBe('none')
        expect(onScreenReady).toHaveBeenCalledTimes(1)

        setInnerWidth(MIN_SCREEN_WIDTH_PX + 200)
        window.dispatchEvent(new Event('resize'))

        expect(onScreenReady).toHaveBeenCalledTimes(1)
    })

    it('re-shows the overlay without calling onScreenReady again if the width drops back below the threshold', () => {
        setInnerWidth(MIN_SCREEN_WIDTH_PX - 1)
        const overlay = createScreenSizeBlockOverlay()
        const onScreenReady = vi.fn()

        initScreenSizeGuard(overlay, onScreenReady)

        setInnerWidth(MIN_SCREEN_WIDTH_PX)
        window.dispatchEvent(new Event('resize'))
        expect(onScreenReady).toHaveBeenCalledTimes(1)

        setInnerWidth(MIN_SCREEN_WIDTH_PX - 1)
        window.dispatchEvent(new Event('resize'))

        expect(overlay.style.display).toBe('flex')
        expect(onScreenReady).toHaveBeenCalledTimes(1)
    })
})
