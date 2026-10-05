import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCanvasCaptureStreamSupported, isScreenShareHostSupported, isWebRtcBlocked, isWebRtcSupported } from '../features/screen-share/compat'

describe('screen share compatibility checks', () => {
    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'RTCPeerConnection')
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
    })

    it('reports WebRTC as unsupported when RTCPeerConnection is missing', () => {
        expect(isWebRtcSupported()).toBe(false)
    })

    it('reports WebRTC as supported when RTCPeerConnection is available', () => {
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}

        expect(isWebRtcSupported()).toBe(true)
    })

    it('reports canvas capture as unsupported when captureStream is missing', () => {
        expect(isCanvasCaptureStreamSupported()).toBe(false)
    })

    it('reports canvas capture as supported when captureStream is available', () => {
        HTMLCanvasElement.prototype.captureStream = (): MediaStream => new MediaStream()

        expect(isCanvasCaptureStreamSupported()).toBe(true)
    })

    it('requires both WebRTC and canvas capture support for the host role', () => {
        expect(isScreenShareHostSupported()).toBe(false)

        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
        HTMLCanvasElement.prototype.captureStream = (): MediaStream => new MediaStream()

        expect(isScreenShareHostSupported()).toBe(true)
    })
})

class FakePeerConnection {
    static instances: FakePeerConnection[] = []
    static firstCandidate: RTCIceCandidate | null | undefined = undefined
    static offerError: Error | null = null
    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null
    close: () => void = vi.fn()

    constructor(readonly config: RTCConfiguration) {
        FakePeerConnection.instances.push(this)
    }

    createDataChannel(): void {}

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        if (FakePeerConnection.offerError) {
            throw FakePeerConnection.offerError
        }
        return { type: 'offer', sdp: '' }
    }

    async setLocalDescription(): Promise<void> {
        const candidate = FakePeerConnection.firstCandidate
        if (candidate !== undefined) {
            queueMicrotask((): void => this.onicecandidate?.({ candidate } as RTCPeerConnectionIceEvent))
        }
    }
}

describe('isWebRtcBlocked', () => {
    beforeEach(() => {
        FakePeerConnection.instances = []
        FakePeerConnection.firstCandidate = undefined
        FakePeerConnection.offerError = null
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = FakePeerConnection
    })

    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'RTCPeerConnection')
        vi.useRealTimers()
    })

    it('reports WebRTC as blocked when candidate gathering ends without a single candidate', async () => {
        FakePeerConnection.firstCandidate = null

        expect(await isWebRtcBlocked([])).toBe(true)
    })

    it('reports WebRTC as usable as soon as a candidate is gathered', async () => {
        FakePeerConnection.firstCandidate = { type: 'host' } as RTCIceCandidate

        expect(await isWebRtcBlocked([])).toBe(false)
    })

    it('reports WebRTC as usable when no candidate event arrives before the timeout, to avoid a false alarm', async () => {
        vi.useFakeTimers()
        const result = isWebRtcBlocked([], 1000)

        await vi.advanceTimersByTimeAsync(1000)

        expect(await result).toBe(false)
    })

    it('reports WebRTC as usable when the offer cannot be created', async () => {
        FakePeerConnection.offerError = new Error('boom')

        expect(await isWebRtcBlocked([])).toBe(false)
    })

    it('gathers candidates with the given ICE servers and closes the probe connection afterwards', async () => {
        FakePeerConnection.firstCandidate = null
        const iceServers = [{ urls: 'stun:stun.test:3478' }]

        await isWebRtcBlocked(iceServers)

        const [connection] = FakePeerConnection.instances
        expect(connection.config).toEqual({ iceServers })
        expect(connection.close).toHaveBeenCalledTimes(1)
    })
})
