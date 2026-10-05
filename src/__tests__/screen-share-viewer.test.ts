import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VIEWER_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '../types/theme.types'

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{
        leave: ReturnType<typeof vi.fn>
        makeAction: ReturnType<typeof vi.fn>
        onPeerStream: ((stream: unknown, peerId: string) => void) | null
        onPeerLeave: ((peerId: string) => void) | null
    }> = []

    const joinRoom = vi.fn(() => {
        const room = { leave: vi.fn(), makeAction: vi.fn(() => ({ send: vi.fn(), onMessage: null })), onPeerStream: null, onPeerLeave: null }
        rooms.push(room)
        return room
    })

    return { joinRoom, rooms }
})

vi.mock('trystero', () => ({ joinRoom }))

const { ThemeServiceMock } = vi.hoisted(() => {
    const ThemeServiceMock = vi.fn(
        class {
            getResolvedTheme(): void {}
        },
    )

    return { ThemeServiceMock }
})

vi.mock('../features/theme/theme-service', () => ({ ThemeService: ThemeServiceMock }))

// Only the theme wiring in initScreenShareViewer is covered here.
describe('initScreenShareViewer theme wiring', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        ThemeServiceMock.mockClear()
        document.body.innerHTML = ''
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
    })

    it('builds its own ThemeService scoped to the viewer-dedicated storage key', async () => {
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())

        expect(ThemeServiceMock).toHaveBeenCalledTimes(1)
        expect(ThemeServiceMock).toHaveBeenCalledWith(expect.anything(), VIEWER_THEME_STORAGE_KEY)
    })

    it('never constructs its ThemeService with the host app storage key', async () => {
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())

        const usedKeys = ThemeServiceMock.mock.calls.map((call: unknown[]) => call[1])
        expect(usedKeys).not.toContain(THEME_STORAGE_KEY)
        expect(VIEWER_THEME_STORAGE_KEY).not.toBe(THEME_STORAGE_KEY)
    })
})

describe('initScreenShareViewer signaling configuration', () => {
    beforeEach(() => {
        joinRoom.mockClear()
        document.body.innerHTML = ''
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it('hides the status banner, rather than claiming the browser is unsupported, without joining a room when the signaling configuration is invalid', async () => {
        vi.spyOn(console, 'error').mockImplementation((): void => {})
        vi.stubEnv('VITE_SIGNALING_RELAYS', 'relay.test')
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())

        expect(joinRoom).not.toHaveBeenCalled()
        const status = document.querySelector('.screen-share-viewer-status')!
        expect(status.textContent).toBe('')
        expect(status.classList.contains('screen-share-viewer-status--visible')).toBe(false)
    })
})
