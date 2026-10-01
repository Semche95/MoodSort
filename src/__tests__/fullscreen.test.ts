import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFullscreenActive, isFullscreenSupported, onFullscreenChange, toggleFullscreen } from '../features/fullscreen/fullscreen'
import { mockFullscreenApi } from './fullscreen-api-mock'
import type { FullscreenApiMock } from './fullscreen-api-mock'

describe('fullscreen', () => {
    let api: FullscreenApiMock | null = null

    afterEach(() => {
        api?.restore()
        api = null
    })

    describe('isFullscreenSupported', () => {
        it('returns false when neither the standard nor the webkit API is enabled', () => {
            expect(isFullscreenSupported()).toBe(false)
        })

        it('returns true when the standard API is enabled', () => {
            api = mockFullscreenApi('standard')

            expect(isFullscreenSupported()).toBe(true)
        })

        it('returns true when only the webkit-prefixed API is enabled', () => {
            api = mockFullscreenApi('webkit')

            expect(isFullscreenSupported()).toBe(true)
        })
    })

    describe('isFullscreenActive', () => {
        it('reflects the standard fullscreenElement', () => {
            api = mockFullscreenApi('standard')
            expect(isFullscreenActive()).toBe(false)

            api.setElement(document.documentElement)
            expect(isFullscreenActive()).toBe(true)
        })

        it('reflects the webkit-prefixed fullscreen element', () => {
            api = mockFullscreenApi('webkit')
            expect(isFullscreenActive()).toBe(false)

            api.setElement(document.documentElement)
            expect(isFullscreenActive()).toBe(true)
        })
    })

    describe('toggleFullscreen', () => {
        it('requests fullscreen on the document element when not in fullscreen', async () => {
            api = mockFullscreenApi('standard')

            await toggleFullscreen()

            expect(api.request).toHaveBeenCalledOnce()
            expect(api.request.mock.contexts[0]).toBe(document.documentElement)
            expect(api.exit).not.toHaveBeenCalled()
        })

        it('exits fullscreen when already in fullscreen', async () => {
            api = mockFullscreenApi('standard')
            api.setElement(document.documentElement)

            await toggleFullscreen()

            expect(api.exit).toHaveBeenCalledOnce()
            expect(api.request).not.toHaveBeenCalled()
        })

        it('falls back to the webkit-prefixed request and exit methods', async () => {
            api = mockFullscreenApi('webkit')

            await toggleFullscreen()
            expect(api.request).toHaveBeenCalledOnce()
            expect(api.request.mock.contexts[0]).toBe(document.documentElement)

            api.setElement(document.documentElement)
            await toggleFullscreen()
            expect(api.exit).toHaveBeenCalledOnce()
        })

        it('swallows a rejected fullscreen request', async () => {
            api = mockFullscreenApi('standard')
            api.request.mockRejectedValue(new TypeError('Permissions check failed'))

            await expect(toggleFullscreen()).resolves.toBeUndefined()
        })

        it('swallows a fullscreen request that throws synchronously', async () => {
            api = mockFullscreenApi('webkit')
            api.request.mockImplementation((): void => {
                throw new Error('Not allowed')
            })

            await expect(toggleFullscreen()).resolves.toBeUndefined()
        })
    })

    describe('onFullscreenChange', () => {
        it('listens to the standard fullscreenchange event', () => {
            api = mockFullscreenApi('standard')
            const callback = vi.fn()
            onFullscreenChange(callback)

            document.dispatchEvent(new Event('webkitfullscreenchange'))
            expect(callback).not.toHaveBeenCalled()

            document.dispatchEvent(new Event('fullscreenchange'))
            expect(callback).toHaveBeenCalledOnce()
        })

        it('listens to the webkit-prefixed change event when only the webkit API is available', () => {
            api = mockFullscreenApi('webkit')
            const callback = vi.fn()
            onFullscreenChange(callback)

            document.dispatchEvent(new Event('fullscreenchange'))
            expect(callback).not.toHaveBeenCalled()

            document.dispatchEvent(new Event('webkitfullscreenchange'))
            expect(callback).toHaveBeenCalledOnce()
        })
    })
})
