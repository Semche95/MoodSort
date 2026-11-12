import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VIEWER_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '../types/theme.types'
import { ScreenShareViewer } from '../features/screen-share/screen-share-viewer'
import { ROOM_BUSY_ACTION, SCREEN_SHARE_GRACE_TIMEOUT_MS, STREAM_FAILED_ACTION } from '../features/screen-share/room-config'

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{
        leave: ReturnType<typeof vi.fn>
        makeAction: ReturnType<typeof vi.fn>
        ping: ReturnType<typeof vi.fn>
        onPeerStream: ReturnType<typeof vi.fn>
        onPeerLeave: ReturnType<typeof vi.fn>
    }> = []

    const joinRoom = vi.fn(() => {
        const room = { leave: vi.fn(), makeAction: vi.fn(() => ({ send: vi.fn(), onMessage: vi.fn() })), ping: vi.fn(() => Promise.resolve(1)), onPeerStream: vi.fn(), onPeerLeave: vi.fn() }
        rooms.push(room)
        return room
    })

    return { joinRoom, rooms }
})

vi.mock('trystero', () => ({ joinRoom }))

const { isWebRtcBlocked } = vi.hoisted(() => ({ isWebRtcBlocked: vi.fn(async (): Promise<boolean> => false) }))

vi.mock('../features/screen-share/compat', async (importOriginal: () => Promise<typeof import('../features/screen-share/compat')>) => ({
    ...(await importOriginal()),
    isWebRtcBlocked,
}))

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

describe('initScreenShareViewer blocked WebRTC detection', () => {
    beforeEach(() => {
        joinRoom.mockClear()
        isWebRtcBlocked.mockReset()
        document.body.innerHTML = ''
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
    })

    it('explains that the browser blocks WebRTC, without joining a room, when no ICE candidate can be gathered', async () => {
        isWebRtcBlocked.mockResolvedValue(true)
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())
        await vi.waitFor(() => expect(isWebRtcBlocked).toHaveBeenCalled())
        await Promise.resolve()

        expect(joinRoom).not.toHaveBeenCalled()
        const status = document.querySelector('.screen-share-viewer-status')!
        expect(status.textContent).toBe('Your browser is blocking WebRTC connections (privacy extension, VPN or browser setting), so the shared layout cannot be displayed. Allow WebRTC or open the link in another browser.')
        expect(status.classList.contains('screen-share-viewer-status--visible')).toBe(true)
    })

    it('joins the room once the check confirms WebRTC is usable', async () => {
        isWebRtcBlocked.mockResolvedValue(false)
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())

        await vi.waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))
    })

    it('does not join the room when the viewer is closed before the check completes', async () => {
        let resolveCheck: (blocked: boolean) => void = (): void => {}
        isWebRtcBlocked.mockReturnValue(new Promise<boolean>((resolve: (blocked: boolean) => void): void => { resolveCheck = resolve }))
        const { initScreenShareViewer } = await import('../features/screen-share/screen-share-viewer')

        initScreenShareViewer('AB12CD', vi.fn())
        document.querySelector<HTMLButtonElement>('.screen-share-viewer-close')!.click()
        resolveCheck(false)
        await Promise.resolve()
        await Promise.resolve()

        expect(joinRoom).not.toHaveBeenCalled()
    })
})

describe('ScreenShareViewer peer filtering', () => {
    function startViewer(): { onStream: ReturnType<typeof vi.fn>; onStatusChange: ReturnType<typeof vi.fn>; onRoomBusy: ReturnType<typeof vi.fn>; room: (typeof rooms)[number] } {
        const onStream = vi.fn()
        const onStatusChange = vi.fn()
        const onRoomBusy = vi.fn()
        new ScreenShareViewer('AB12CD', onStream, onStatusChange, vi.fn(), onRoomBusy).start()
        return { onStream, onStatusChange, onRoomBusy, room: rooms[rooms.length - 1] }
    }

    function receiveStream(room: (typeof rooms)[number], peerId: string): void {
        room.onPeerStream.mock.calls[0][0]('stream', { peerId })
    }

    function leave(room: (typeof rooms)[number], peerId: string): void {
        room.onPeerLeave.mock.calls[0][0]({ peerId })
    }

    function receiveMessage(room: (typeof rooms)[number], namespace: string, peerId: string): void {
        const index = room.makeAction.mock.calls.findIndex((call: unknown[]): boolean => call[0] === namespace)
        room.makeAction.mock.results[index].value.onMessage.mock.calls[0][0](null, { peerId })
    }

    beforeEach(() => {
        rooms.length = 0
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('ignores another viewer leaving while the stream plays', () => {
        const { onStatusChange, room } = startViewer()

        receiveStream(room, 'host')
        leave(room, 'other-viewer')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
        expect(room.leave).not.toHaveBeenCalled()
    })

    it('waits again when the host that sent the stream leaves', () => {
        const { onStatusChange, room } = startViewer()

        receiveStream(room, 'host')
        leave(room, 'host')

        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
    })

    it('leaves the room on a room-busy notice received before any stream', () => {
        const { onRoomBusy, room } = startViewer()

        receiveMessage(room, ROOM_BUSY_ACTION, 'host')

        expect(onRoomBusy).toHaveBeenCalledOnce()
        expect(room.leave).toHaveBeenCalledOnce()
    })

    it('ignores a room-busy notice from a peer other than the host sending the stream', () => {
        const { onRoomBusy, onStatusChange, room } = startViewer()

        receiveStream(room, 'host')
        receiveMessage(room, ROOM_BUSY_ACTION, 'other-viewer')

        expect(onRoomBusy).not.toHaveBeenCalled()
        expect(room.leave).not.toHaveBeenCalled()
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    })

    it('ignores a stream from another peer while the host still answers a ping', async () => {
        const { onStream, room } = startViewer()

        receiveStream(room, 'host')
        receiveStream(room, 'other-viewer')
        await vi.advanceTimersByTimeAsync(0)

        expect(room.ping).toHaveBeenCalledWith('host')
        expect(onStream).toHaveBeenCalledOnce()
    })

    it('switches to the stream of a new peer once the previous host no longer answers', async () => {
        const { onStream, onStatusChange, room } = startViewer()

        receiveStream(room, 'host')
        room.ping.mockRejectedValueOnce(new Error('closed'))
        receiveStream(room, 'reloaded-host')
        await vi.advanceTimersByTimeAsync(0)
        leave(room, 'host')

        expect(onStream).toHaveBeenCalledTimes(2)
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    })

    it('leaves and rejoins the room, still waiting, when the host reports the stream failed', () => {
        const { onRoomBusy, onStatusChange, room } = startViewer()

        receiveMessage(room, STREAM_FAILED_ACTION, 'host')

        expect(room.leave).toHaveBeenCalledOnce()
        expect(rooms).toHaveLength(2)
        expect(onRoomBusy).not.toHaveBeenCalled()
        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
    })

    it('keeps the grace timeout running across a rejoin after a failed stream', () => {
        const { onStatusChange, room } = startViewer()

        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS / 2)
        receiveMessage(room, STREAM_FAILED_ACTION, 'host')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS / 2)

        expect(onStatusChange).toHaveBeenLastCalledWith('stopped')
        expect(rooms[1].leave).toHaveBeenCalledOnce()
    })

    it('waits again under a fresh grace timeout when a stream that was playing fails', () => {
        const { onStatusChange, room } = startViewer()

        receiveStream(room, 'host')
        receiveMessage(room, STREAM_FAILED_ACTION, 'host')

        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)
        expect(onStatusChange).toHaveBeenLastCalledWith('stopped')
    })
})
