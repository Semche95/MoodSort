export function isWebRtcSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined'
}

export function isCanvasCaptureStreamSupported(): boolean {
    return typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

export function isScreenShareHostSupported(): boolean {
    return isWebRtcSupported() && isCanvasCaptureStreamSupported()
}

const ICE_CHECK_TIMEOUT_MS = 5000

// Privacy extensions or browser policies can suppress every ICE candidate, which leaves Trystero waiting forever.
export async function isWebRtcBlocked(iceServers: RTCIceServer[], timeoutMs: number = ICE_CHECK_TIMEOUT_MS): Promise<boolean> {
    const connection = new RTCPeerConnection({ iceServers })
    const firstCandidate = new Promise<boolean>((resolve: (blocked: boolean) => void): void => {
        connection.onicecandidate = (event: RTCPeerConnectionIceEvent): void => resolve(event.candidate === null)
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<boolean>((resolve: (blocked: boolean) => void): void => {
        timer = setTimeout((): void => resolve(false), timeoutMs)
    })
    try {
        connection.createDataChannel('ice-check')
        await connection.setLocalDescription(await connection.createOffer())
        return await Promise.race([firstCandidate, timeout])
    } catch {
        return false
    } finally {
        clearTimeout(timer)
        connection.close()
    }
}
