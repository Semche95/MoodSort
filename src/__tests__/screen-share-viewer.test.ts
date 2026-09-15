import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenShareViewer, initScreenShareViewer } from '../features/screen-share/screen-share-viewer'
import { SCREEN_SHARE_GRACE_TIMEOUT_MS } from '../features/screen-share/room-config'

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

describe('ScreenShareViewer', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        document.body.innerHTML = ''
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('joins the room and reports waiting status', () => {
        const onStatusChange = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', vi.fn(), onStatusChange)

        viewer.start()

        expect(joinRoom).toHaveBeenCalledWith(expect.objectContaining({ appId: expect.any(String) }), 'AB12CD')
        expect(onStatusChange).toHaveBeenCalledWith('waiting')
    })

    it('forwards the received stream and reports connected status', () => {
        const onStream = vi.fn()
        const onStatusChange = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', onStream, onStatusChange)

        viewer.start()
        rooms[0].onPeerStream?.('the-stream', 'host-peer')

        expect(onStream).toHaveBeenCalledWith('the-stream')
        expect(onStatusChange).toHaveBeenCalledWith('connected')
    })

    it('waits in the same room, without rejoining, when the host disconnects', () => {
        const onStatusChange = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', vi.fn(), onStatusChange)

        viewer.start()
        rooms[0].onPeerStream?.('the-stream', 'host-peer')
        rooms[0].onPeerLeave?.('host-peer')

        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
        expect(joinRoom).toHaveBeenCalledTimes(1)
    })

    it('resumes once the host reconnects within the grace period, cancelling the timeout', () => {
        const onStream = vi.fn()
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', onStream, onStatusChange, onTimedOut)

        viewer.start()
        rooms[0].onPeerLeave?.('host-peer')
        rooms[0].onPeerStream?.('the-stream', 'host-peer')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(onStatusChange).not.toHaveBeenCalledWith('stopped')
        expect(onTimedOut).not.toHaveBeenCalled()
    })

    it('gives up and leaves the room after too long without the host', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', vi.fn(), onStatusChange, onTimedOut)

        viewer.start()
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(onStatusChange).toHaveBeenLastCalledWith('stopped')
        expect(onTimedOut).toHaveBeenCalledOnce()
    })

    it('leaves the room and reports being rejected when the host says the room is busy', () => {
        const onRoomBusy = vi.fn()
        const viewer = new ScreenShareViewer('AB12CD', vi.fn(), vi.fn(), vi.fn(), onRoomBusy)

        viewer.start()
        const roomBusyAction = rooms[0].makeAction.mock.results[0].value
        roomBusyAction.onMessage(null, { peerId: 'host-peer' })

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(onRoomBusy).toHaveBeenCalledOnce()
    })
})

describe('initScreenShareViewer', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        document.body.innerHTML = ''
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
    })

    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'RTCPeerConnection')
    })

    it('renders a fullscreen video element and a status banner, with no Pixi canvas', () => {
        initScreenShareViewer('AB12CD', vi.fn())

        const container = document.querySelector('.screen-share-viewer')
        expect(container).not.toBeNull()
        expect(container?.querySelector('video')).not.toBeNull()
        expect(document.querySelector('canvas')).toBeNull()
    })

    it('attaches the received stream to the video element once connected', () => {
        initScreenShareViewer('AB12CD', vi.fn())
        const video = document.querySelector('video') as HTMLVideoElement

        rooms[0].onPeerStream?.('the-stream', 'host-peer')

        expect(video.srcObject).toBe('the-stream')
    })

    it('shows an explicit error when the host reports the room is already busy', () => {
        initScreenShareViewer('AB12CD', vi.fn())
        const roomBusyAction = rooms[0].makeAction.mock.results[0].value

        roomBusyAction.onMessage(null, { peerId: 'host-peer' })

        const status = document.querySelector('.screen-share-viewer-status')
        expect(status?.textContent).toContain('déjà suivi')
        expect(status?.classList.contains('screen-share-viewer-status--visible')).toBe(true)
    })

    it('removes the overlay, leaves the room and calls onClose when the close button is clicked', () => {
        const onClose = vi.fn()
        initScreenShareViewer('AB12CD', onClose)

        document.querySelector<HTMLButtonElement>('.screen-share-viewer-close')?.click()

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(document.querySelector('.screen-share-viewer')).toBeNull()
        expect(onClose).toHaveBeenCalled()
    })
})
