import { joinRoom } from 'trystero'
import type { Room } from 'trystero'
import type { ConnectionStatus } from '../../types/screen-share.types'
import { buildRoomConfig, ROOM_BUSY_ACTION, SCREEN_SHARE_GRACE_TIMEOUT_MS } from './room-config'
import { GraceTimeout } from './grace-timeout'

// Host side of a screen-share session. Trystero only negotiates the WebRTC connection;
// the captured canvas stream is sent peer-to-peer via `room.addStream`.
// Only one viewer is accepted at a time. If the connected viewer leaves, the room stays
// open under a grace timeout so a reconnecting viewer resumes it instead of a new one being created.
export class ScreenShareHost {
    private room: Room | null = null
    private stream: MediaStream | null = null
    private connectedPeerId: string | null = null
    private readonly graceTimeout = new GraceTimeout((): void => {
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

        const roomBusy = room.makeAction<null>(ROOM_BUSY_ACTION)

        room.onPeerJoin = (peerId: string): void => {
            if (this.connectedPeerId !== null) {
                roomBusy.send(null, { target: peerId })
                return
            }
            this.connectedPeerId = peerId
            this.graceTimeout.clear()
            if (this.stream) {
                room.addStream(this.stream, { target: peerId })
            }
            this.onStatusChange('connected')
        }

        room.onPeerLeave = (peerId: string): void => {
            if (peerId !== this.connectedPeerId) {
                return
            }
            this.connectedPeerId = null
            this.onStatusChange('waiting')
            this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)
        }
    }

    stop(): void {
        this.graceTimeout.clear()
        this.room?.leave()
        this.room = null
        this.connectedPeerId = null
        for (const track of this.stream?.getTracks() ?? []) {
            track.stop()
        }
        this.stream = null
    }
}
