import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    activateSharing,
    getSharingState,
    regenerateSharingCode,
    resumeSharingIfWasActive,
    stopSharing,
    subscribeToSharing,
} from '../features/screen-share/screen-share-session'
import { SCREEN_SHARE_GRACE_TIMEOUT_MS } from '../features/screen-share/room-config'

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{ leave: ReturnType<typeof vi.fn>; addStream: ReturnType<typeof vi.fn>; makeAction: ReturnType<typeof vi.fn>; onPeerJoin: unknown; onPeerLeave: unknown }> = []
    const joinRoom = vi.fn(() => {
        const room = { leave: vi.fn(), addStream: vi.fn(), makeAction: vi.fn(() => ({ send: vi.fn(), onMessage: null })), onPeerJoin: null, onPeerLeave: null }
        rooms.push(room)
        return room
    })
    return { joinRoom, rooms }
})

vi.mock('trystero', () => ({ joinRoom }))

function createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.captureStream = vi.fn((): MediaStream => ({
        getTracks: (): MediaStreamTrack[] => [],
        getVideoTracks: (): MediaStreamTrack[] => [{ contentHint: '' } as MediaStreamTrack],
    }) as MediaStream)
    return canvas
}

const localStorageMock: Record<string, string> = {}

describe('screen-share-session', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        vi.useFakeTimers()
        Object.keys(localStorageMock).forEach((key: string) => delete localStorageMock[key])
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: vi.fn((key: string): string | null => localStorageMock[key] ?? null),
                setItem: vi.fn((key: string, value: string): void => { localStorageMock[key] = value }),
                removeItem: vi.fn((key: string): void => { delete localStorageMock[key] }),
                clear: vi.fn((): void => { Object.keys(localStorageMock).forEach((k: string) => delete localStorageMock[k]) }),
            },
            writable: true,
            configurable: true,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts inactive with a stable room code before anything is activated', () => {
        const canvas = createCanvas()

        const state = getSharingState(canvas)

        expect(state.status).toBe('inactive')
        expect(state.roomCode).toMatch(/^[A-Z0-9]{6}$/)
        expect(joinRoom).not.toHaveBeenCalled()
    })

    it('joins a room under the existing code once activated, and notifies subscribers', () => {
        const canvas = createCanvas()
        const listener = vi.fn()
        subscribeToSharing(canvas, listener)
        const code = getSharingState(canvas).roomCode

        activateSharing(canvas)

        expect(joinRoom).toHaveBeenCalledWith(expect.objectContaining({ appId: expect.any(String) }), code)
        expect(listener).toHaveBeenCalledWith({ roomCode: code, status: 'waiting' })
    })

    it('leaves the room without changing the code when sharing is explicitly stopped', () => {
        const canvas = createCanvas()
        const code = getSharingState(canvas).roomCode
        activateSharing(canvas)

        stopSharing(canvas)

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(getSharingState(canvas)).toEqual({ roomCode: code, status: 'inactive' })
    })

    it('destroys the old room and starts a new one under a new code when regenerating', () => {
        const canvas = createCanvas()
        activateSharing(canvas)
        const firstCode = getSharingState(canvas).roomCode

        regenerateSharingCode(canvas)

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        const state = getSharingState(canvas)
        expect(state.roomCode).not.toBe(firstCode)
        expect(state.status).toBe('waiting')
        expect(joinRoom).toHaveBeenCalledTimes(2)
    })

    it('does not rejoin a room when regenerating the code while inactive', () => {
        const canvas = createCanvas()

        regenerateSharingCode(canvas)

        expect(joinRoom).not.toHaveBeenCalled()
        expect(getSharingState(canvas).status).toBe('inactive')
    })

    it('goes back to inactive, without touching the room code, once the grace period elapses with nobody connected', () => {
        const canvas = createCanvas()
        const code = getSharingState(canvas).roomCode
        activateSharing(canvas)

        vi.advanceTimersByTime(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        expect(getSharingState(canvas)).toEqual({ roomCode: code, status: 'stopped' })
        // Reactivating after the timeout reuses the same code: nothing regenerates it but an explicit request.
        activateSharing(canvas)
        expect(getSharingState(canvas).roomCode).toBe(code)
    })

    it('resumes sharing automatically when it was left active, simulating a host page refresh', () => {
        const canvas = createCanvas()
        activateSharing(canvas)
        const code = getSharingState(canvas).roomCode

        // A fresh canvas + a fresh WeakMap entry stand in for the new JS context after a reload.
        const reloadedCanvas = createCanvas()
        resumeSharingIfWasActive(reloadedCanvas)

        expect(getSharingState(reloadedCanvas)).toEqual({ roomCode: code, status: 'waiting' })
    })

    it('does not resume sharing on boot when it was not left active', () => {
        const canvas = createCanvas()

        resumeSharingIfWasActive(canvas)

        expect(joinRoom).not.toHaveBeenCalled()
        expect(getSharingState(canvas).status).toBe('inactive')
    })
})
