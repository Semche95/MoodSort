import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenShareHost } from '../features/screen-share/screen-share-host'
import { SCREEN_SHARE_GRACE_TIMEOUT_MS } from '../features/screen-share/room-config'

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{
        appId: string
        roomId: string
        addStream: ReturnType<typeof vi.fn>
        leave: ReturnType<typeof vi.fn>
        makeAction: ReturnType<typeof vi.fn>
        onPeerJoin: ((peerId: string) => void) | null
        onPeerLeave: ((peerId: string) => void) | null
    }> = []

    const joinRoom = vi.fn((config: { appId: string }, roomId: string) => {
        const room = {
            appId: config.appId,
            roomId,
            addStream: vi.fn(),
            leave: vi.fn(),
            makeAction: vi.fn(() => ({ send: vi.fn(), onMessage: null })),
            onPeerJoin: null,
            onPeerLeave: null,
        }
        rooms.push(room)
        return room
    })

    return { joinRoom, rooms }
})

vi.mock('trystero', () => ({ joinRoom }))

function fakeStream(): unknown {
    return { getVideoTracks: (): unknown[] => [{ contentHint: '' }], getTracks: (): unknown[] => [] }
}

class FakeCanvas {
    private stream: unknown = fakeStream()
    captureStream: ReturnType<typeof vi.fn> = vi.fn((): unknown => this.stream)
}

describe('ScreenShareHost', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('joins the room named after the room code and reports waiting status', () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()

        expect(joinRoom).toHaveBeenCalledWith(expect.objectContaining({ appId: expect.any(String) }), 'AB12CD')
        expect(onStatusChange).toHaveBeenCalledWith('waiting')
    })

    it('captures the canvas at the requested fps and sends it to a peer that joins', () => {
        const canvas = new FakeCanvas()
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', canvas as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].onPeerJoin?.('peer-1')

        expect(canvas.captureStream).toHaveBeenCalledWith(18)
        expect(rooms[0].addStream).toHaveBeenCalledWith(canvas.captureStream.mock.results[0].value, { target: 'peer-1' })
        expect(onStatusChange).toHaveBeenCalledWith('connected')
    })

    it('ignores a second peer while one viewer is already connected', () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].onPeerJoin?.('peer-1')
        onStatusChange.mockClear()
        rooms[0].onPeerJoin?.('peer-2')

        expect(rooms[0].addStream).not.toHaveBeenCalledWith('fake-stream', { target: 'peer-2' })
        expect(onStatusChange).not.toHaveBeenCalled()
    })

    it('tells a rejected second peer the room is busy', () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].onPeerJoin?.('peer-1')
        const roomBusy = rooms[0].makeAction.mock.results[0].value
        rooms[0].onPeerJoin?.('peer-2')

        expect(roomBusy.send).toHaveBeenCalledWith(null, { target: 'peer-2' })
    })

    it('goes back to waiting, without rejoining the room, when the connected viewer leaves', () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].onPeerJoin?.('peer-1')
        rooms[0].onPeerLeave?.('peer-1')

        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
        expect(joinRoom).toHaveBeenCalledTimes(1)
    })

    it('accepts the same or a new viewer again after one leaves, cancelling the grace timeout', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, onTimedOut)

        host.start()
        rooms[0].onPeerJoin?.('peer-1')
        rooms[0].onPeerLeave?.('peer-1')
        rooms[0].onPeerJoin?.('peer-2')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(onStatusChange).not.toHaveBeenCalledWith('stopped')
        expect(onTimedOut).not.toHaveBeenCalled()
    })

    it('tears the session down and reports timing out when nobody connects within the grace period', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, onTimedOut)

        host.start()
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(onStatusChange).toHaveBeenLastCalledWith('stopped')
        expect(onTimedOut).toHaveBeenCalledOnce()
    })

    it('tears the session down when a viewer disconnects and does not return within the grace period', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, onTimedOut)

        host.start()
        rooms[0].onPeerJoin?.('peer-1')
        rooms[0].onPeerLeave?.('peer-1')
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(onStatusChange).toHaveBeenLastCalledWith('stopped')
        expect(onTimedOut).toHaveBeenCalledOnce()
    })

    it('leaves the room and stops the stream tracks on stop', () => {
        const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
        const stream = { getTracks: vi.fn(() => tracks), getVideoTracks: (): unknown[] => [{ contentHint: '' }] }
        const canvas = { captureStream: vi.fn(() => stream) }
        const host = new ScreenShareHost('AB12CD', canvas as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        host.stop()

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        for (const track of tracks) {
            expect(track.stop).toHaveBeenCalledOnce()
        }
    })

    it('does not time out after stop, since the grace timeout is cancelled', () => {
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), onTimedOut)

        host.start()
        host.stop()
        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(onTimedOut).not.toHaveBeenCalled()
    })
})
