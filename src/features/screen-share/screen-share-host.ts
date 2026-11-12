import { joinRoom } from 'trystero'
import type { MessageAction, Room } from 'trystero'
import type { ConnectionStatus } from '../../types/screen-share.types'
import { buildRoomConfig, ROOM_BUSY_ACTION, SCREEN_SHARE_GRACE_TIMEOUT_MS, STREAM_FAILED_ACTION } from './room-config'
import { GraceTimeout } from './grace-timeout'
import { isPeerAlive } from './peer-liveness'
import { withTimeout } from './with-timeout'

const STREAM_SEND_ATTEMPTS = 3
const STREAM_SEND_RETRY_MS = 2000
// A stalled renegotiation can leave addStream pending forever, which would hold the viewer slot.
const STREAM_SEND_TIMEOUT_MS = 10000

// Host side of a screen-share session. Trystero only negotiates the WebRTC connection;
// the captured canvas stream is sent peer-to-peer via `room.addStream`.
// Only one viewer is accepted at a time. If the connected viewer leaves, the room stays
// open under a grace timeout so a reconnecting viewer resumes it instead of a new one being created.
export class ScreenShareHost {
    private room: Room | null = null
    private stream: MediaStream | null = null
    private connectedPeerId: string | null = null
    private roomBusy: MessageAction<null> | null = null
    private streamFailed: MessageAction<null> | null = null
    private readonly joiningPeers: Set<string> = new Set()
    private streamSendAttempts: number = 0
    private readonly streamSendRetry: GraceTimeout = new GraceTimeout((): void => this.sendStream())
    private readonly graceTimeout: GraceTimeout = new GraceTimeout((): void => {
        this.stop()
        this.onStatusChange('stopped')
        this.onTimedOut()
    })

    constructor(
        private readonly roomCode: string,
        private readonly canvas: HTMLCanvasElement,
        private readonly fps: number,
        private readonly onStatusChange: (status: ConnectionStatus) => void,
        private readonly onTimedOut: () => void,
    ) {}

    start(): void {
        this.stream = this.canvas.captureStream(this.fps)
        const [videoTrack] = this.stream.getVideoTracks()
        videoTrack.contentHint = 'detail'

        const room = joinRoom(buildRoomConfig(), this.roomCode)
        this.room = room
        this.onStatusChange('waiting')
        this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)

        this.roomBusy = room.makeAction<null>(ROOM_BUSY_ACTION)
        this.streamFailed = room.makeAction<null>(STREAM_FAILED_ACTION)

        room.onPeerJoin(({ peerId }: { peerId: string }): void => this.onPeerJoin(room, peerId))

        room.onPeerLeave(({ peerId }: { peerId: string }): void => {
            this.joiningPeers.delete(peerId)
            this.releasePeer(peerId)
        })
    }

    private onPeerJoin(room: Room, peerId: string): void {
        const connectedPeerId = this.connectedPeerId
        if (connectedPeerId === null) {
            this.acceptPeer(peerId)
            return
        }
        this.joiningPeers.add(peerId)
        void isPeerAlive(room, connectedPeerId).then((alive: boolean): void => {
            if (!alive) {
                this.releasePeer(connectedPeerId)
            }
            this.admitJoiningPeer(peerId)
        })
    }

    private admitJoiningPeer(peerId: string): void {
        if (!this.joiningPeers.delete(peerId)) {
            return
        }
        if (this.connectedPeerId === null) {
            this.acceptPeer(peerId)
            return
        }
        this.notify(this.roomBusy, peerId)
    }

    private acceptPeer(peerId: string): void {
        this.connectedPeerId = peerId
        this.graceTimeout.clear()
        this.streamSendAttempts = 0
        this.sendStream()
    }

    private sendStream(): void {
        const peerId = this.connectedPeerId
        if (!this.room || !this.stream || peerId === null) {
            return
        }
        this.streamSendAttempts += 1
        withTimeout(this.room.addStream(this.stream, { target: peerId }), STREAM_SEND_TIMEOUT_MS).then(
            (): void => this.onStreamSent(peerId),
            (): void => this.onStreamSendFailed(peerId),
        )
    }

    private onStreamSent(peerId: string): void {
        if (peerId === this.connectedPeerId) {
            this.onStatusChange('connected')
        }
    }

    private onStreamSendFailed(peerId: string): void {
        if (peerId !== this.connectedPeerId) {
            return
        }
        // A failed send may still have attached the tracks, which a retry or the next viewer must not inherit.
        if (this.stream) {
            try {
                this.room?.removeStream(this.stream, { target: peerId })
            } catch {
                // A closed peer connection throws on removeTrack; the retry or release below must still run.
            }
        }
        if (this.streamSendAttempts < STREAM_SEND_ATTEMPTS) {
            this.streamSendRetry.arm(STREAM_SEND_RETRY_MS)
            return
        }
        this.releasePeer(peerId)
        // Without this notice the dropped viewer would wait silently, never joining again to get a new attempt.
        this.notify(this.streamFailed, peerId)
    }

    private notify(action: MessageAction<null> | null, peerId: string): void {
        // The notified viewer may already be gone, which is harmless.
        action?.send(null, { target: peerId }).catch((): void => {})
    }

    private releasePeer(peerId: string): void {
        if (peerId !== this.connectedPeerId) {
            return
        }
        this.connectedPeerId = null
        this.streamSendRetry.clear()
        this.onStatusChange('waiting')
        this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)
    }

    stop(): void {
        this.graceTimeout.clear()
        this.streamSendRetry.clear()
        this.room?.leave()
        this.room = null
        this.roomBusy = null
        this.streamFailed = null
        this.joiningPeers.clear()
        this.connectedPeerId = null
        for (const track of this.stream?.getTracks() ?? []) {
            track.stop()
        }
        this.stream = null
    }
}
