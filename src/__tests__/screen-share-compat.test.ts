import { afterEach, describe, expect, it } from 'vitest'
import { isCanvasCaptureStreamSupported, isScreenShareHostSupported, isWebRtcSupported } from '../features/screen-share/compat'

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
