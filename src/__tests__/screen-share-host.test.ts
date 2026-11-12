import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenShareHost } from '../features/screen-share/screen-share-host'
import { ROOM_BUSY_ACTION, SCREEN_SHARE_GRACE_TIMEOUT_MS, STREAM_FAILED_ACTION } from '../features/screen-share/room-config'

type PeerHandler = (context: { peerId: string }) => void

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{
        appId: string
        roomId: string
        addStream: ReturnType<typeof vi.fn>
        removeStream: ReturnType<typeof vi.fn>
        leave: ReturnType<typeof vi.fn>
        makeAction: ReturnType<typeof vi.fn>
        ping: ReturnType<typeof vi.fn>
        onPeerJoin: ReturnType<typeof vi.fn>
        onPeerLeave: ReturnType<typeof vi.fn>
        peerJoinHandler: PeerHandler | null
        peerLeaveHandler: PeerHandler | null
    }> = []

    const joinRoom = vi.fn((config: { appId: string }, roomId: string) => {
        const room = {
            appId: config.appId,
            roomId,
            addStream: vi.fn(() => Promise.resolve()),
            removeStream: vi.fn(),
            leave: vi.fn(),
            makeAction: vi.fn(() => ({ send: vi.fn(() => Promise.resolve()), onMessage: vi.fn() })),
            ping: vi.fn(() => Promise.resolve(1)),
            peerJoinHandler: null as PeerHandler | null,
            peerLeaveHandler: null as PeerHandler | null,
            onPeerJoin: vi.fn((handler: PeerHandler) => {
                room.peerJoinHandler = handler
            }),
            onPeerLeave: vi.fn((handler: PeerHandler) => {
                room.peerLeaveHandler = handler
            }),
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

function actionSend(room: (typeof rooms)[number], namespace: string): ReturnType<typeof vi.fn> {
    const index = room.makeAction.mock.calls.findIndex((call: unknown[]): boolean => call[0] === namespace)
    return room.makeAction.mock.results[index].value.send
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

    it('captures the canvas at the requested fps and sends it to a peer that joins', async () => {
        const canvas = new FakeCanvas()
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', canvas as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)

        expect(canvas.captureStream).toHaveBeenCalledWith(18)
        expect(rooms[0].addStream).toHaveBeenCalledWith(canvas.captureStream.mock.results[0].value, { target: 'peer-1' })
        expect(onStatusChange).toHaveBeenCalledWith('connected')
    })

    it('reports connected only once the stream has been sent to the viewer', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())
        let resolveSend: () => void = (): void => {}

        host.start()
        rooms[0].addStream.mockReturnValueOnce(new Promise<void>((resolve: () => void): void => {
            resolveSend = resolve
        }))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)

        expect(onStatusChange).not.toHaveBeenCalledWith('connected')
        resolveSend()
        await vi.advanceTimersByTimeAsync(0)
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    })

    it('ignores a second peer while one viewer is already connected', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)
        onStatusChange.mockClear()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(0)

        expect(rooms[0].addStream).not.toHaveBeenCalledWith(expect.anything(), { target: 'peer-2' })
        expect(onStatusChange).not.toHaveBeenCalled()
    })

    it('tells a rejected second peer the room is busy', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(0)

        expect(rooms[0].ping).toHaveBeenCalledWith('peer-1')
        expect(actionSend(rooms[0], ROOM_BUSY_ACTION)).toHaveBeenCalledWith(null, { target: 'peer-2' })
    })

    it('replaces a connected viewer that no longer answers a ping with the peer that just joined', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)
        rooms[0].ping.mockRejectedValueOnce(new Error('closed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(0)

        expect(rooms[0].addStream).toHaveBeenLastCalledWith(expect.anything(), { target: 'peer-2' })
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
        expect(actionSend(rooms[0], ROOM_BUSY_ACTION)).not.toHaveBeenCalled()
    })

    it('treats a connected viewer whose ping never answers as gone', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)
        rooms[0].ping.mockReturnValueOnce(new Promise((): void => {}))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(3000)

        expect(rooms[0].addStream).toHaveBeenLastCalledWith(expect.anything(), { target: 'peer-2' })
    })

    it('does not accept a joining peer that left while the connected viewer was being pinged', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)
        rooms[0].ping.mockRejectedValueOnce(new Error('closed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(0)

        expect(rooms[0].addStream).not.toHaveBeenCalledWith(expect.anything(), { target: 'peer-2' })
        expect(actionSend(rooms[0], ROOM_BUSY_ACTION)).not.toHaveBeenCalled()
    })

    it('goes back to waiting, without rejoining the room, when the connected viewer leaves', () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-1' })

        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
        expect(joinRoom).toHaveBeenCalledTimes(1)
    })

    it('accepts the same or a new viewer again after one leaves, cancelling the grace timeout', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, onTimedOut)

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-1' })
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
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

    it('ignores a room-busy notice that fails because the rejected viewer already left', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        actionSend(rooms[0], ROOM_BUSY_ACTION).mockRejectedValueOnce(new Error('disconnected'))
        await vi.advanceTimersByTimeAsync(0)
        onStatusChange.mockClear()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.runAllTimersAsync()

        expect(onStatusChange).not.toHaveBeenCalled()
    })

    it('retries sending the stream to the connected viewer after a failed attempt', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].addStream.mockRejectedValueOnce(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(2000)

        expect(rooms[0].addStream).toHaveBeenCalledTimes(2)
        expect(rooms[0].addStream).toHaveBeenLastCalledWith(expect.anything(), { target: 'peer-1' })
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    })

    it('counts a stream send that never settles as a failed attempt', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].addStream.mockReturnValueOnce(new Promise((): void => {}))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(10000)

        expect(rooms[0].removeStream).toHaveBeenCalledOnce()
        await vi.advanceTimersByTimeAsync(2000)
        expect(rooms[0].addStream).toHaveBeenCalledTimes(2)
    })

    it('frees the viewer slot and waits again when every attempt to send the stream fails', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())

        host.start()
        rooms[0].addStream.mockRejectedValue(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(4000)

        expect(rooms[0].addStream).toHaveBeenCalledTimes(3)
        expect(onStatusChange).toHaveBeenLastCalledWith('waiting')
        rooms[0].addStream.mockResolvedValue(undefined)
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        await vi.advanceTimersByTimeAsync(0)
        expect(rooms[0].addStream).toHaveBeenLastCalledWith(expect.anything(), { target: 'peer-2' })
        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
    })

    it('detaches a partially sent stream from the viewer before retrying', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].addStream.mockRejectedValueOnce(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)

        expect(rooms[0].removeStream).toHaveBeenCalledWith(rooms[0].addStream.mock.calls[0][0], { target: 'peer-1' })
        expect(rooms[0].addStream).toHaveBeenCalledOnce()
    })

    it('still retries the stream send when detaching it from a closed connection throws', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].removeStream.mockImplementationOnce((): void => {
            throw new Error('InvalidStateError')
        })
        rooms[0].addStream.mockRejectedValueOnce(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(2000)

        expect(rooms[0].addStream).toHaveBeenCalledTimes(2)
    })

    it('tells the dropped viewer the stream failed, not that the room is busy, once every attempt fails', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].addStream.mockRejectedValue(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        const streamFailed = actionSend(rooms[0], STREAM_FAILED_ACTION)
        await vi.advanceTimersByTimeAsync(2000)

        expect(streamFailed).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(2000)
        expect(streamFailed).toHaveBeenCalledWith(null, { target: 'peer-1' })
        expect(actionSend(rooms[0], ROOM_BUSY_ACTION)).not.toHaveBeenCalled()
    })

    it('stops retrying the stream send once the viewer leaves', async () => {
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, vi.fn(), vi.fn())

        host.start()
        rooms[0].addStream.mockRejectedValueOnce(new Error('metadata send failed'))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(0)
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-1' })
        await vi.advanceTimersByTimeAsync(2000)

        expect(rooms[0].addStream).toHaveBeenCalledOnce()
    })

    it('keeps the current viewer when a stream send to a viewer that already left fails late', async () => {
        const onStatusChange = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, vi.fn())
        let rejectFirstSend: (error: Error) => void = (): void => {}

        host.start()
        rooms[0].addStream.mockReturnValueOnce(new Promise((_: unknown, reject: (error: Error) => void): void => {
            rejectFirstSend = reject
        }))
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-1' })
        rooms[0].peerJoinHandler?.({ peerId: 'peer-2' })
        rejectFirstSend(new Error('disconnected'))
        await vi.advanceTimersByTimeAsync(0)
        rooms[0].peerJoinHandler?.({ peerId: 'peer-3' })
        await vi.advanceTimersByTimeAsync(0)

        expect(onStatusChange).toHaveBeenLastCalledWith('connected')
        expect(actionSend(rooms[0], ROOM_BUSY_ACTION)).toHaveBeenCalledWith(null, { target: 'peer-3' })
    })

    it('tears the session down when a viewer disconnects and does not return within the grace period', () => {
        const onStatusChange = vi.fn()
        const onTimedOut = vi.fn()
        const host = new ScreenShareHost('AB12CD', new FakeCanvas() as unknown as HTMLCanvasElement, 18, onStatusChange, onTimedOut)

        host.start()
        rooms[0].peerJoinHandler?.({ peerId: 'peer-1' })
        rooms[0].peerLeaveHandler?.({ peerId: 'peer-1' })
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
