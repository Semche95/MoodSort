export function isWebRtcSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined'
}

export function isCanvasCaptureStreamSupported(): boolean {
    return typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

export function isScreenShareHostSupported(): boolean {
    return isWebRtcSupported() && isCanvasCaptureStreamSupported()
}
