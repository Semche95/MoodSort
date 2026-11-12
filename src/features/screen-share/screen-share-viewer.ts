import { joinRoom } from 'trystero'
import type { Room } from 'trystero'
import type { ConnectionStatus } from '../../types/screen-share.types'
import { buildRoomConfig, getIceServers, isRoomConfigValid, ROOM_BUSY_ACTION, SCREEN_SHARE_GRACE_TIMEOUT_MS, STREAM_FAILED_ACTION } from './room-config'
import { isWebRtcBlocked, isWebRtcSupported } from './compat'
import { GraceTimeout } from './grace-timeout'
import { isPeerAlive } from './peer-liveness'
import { I18n } from '../../i18n/i18n'
import { Store } from '../../shared/utils/store'
import { ThemeService } from '../theme/theme-service'
import { VIEWER_THEME_STORAGE_KEY } from '../../types/theme.types'

// Spectator side of a screen-share session; only receives the host's video stream, never renders Pixi.
// Stays in the same signaling room across a host disconnect, waiting again for `onPeerStream`
// bounded by the grace timeout, instead of leaving and rejoining.
export class ScreenShareViewer {
    private room: Room | null = null
    private hostPeerId: string | null = null
    private readonly graceTimeout: GraceTimeout = new GraceTimeout((): void => {
        this.stop()
        this.onStatusChange('stopped')
        this.onTimedOut()
    })

    constructor(
        private readonly roomCode: string,
        private readonly onStream: (stream: MediaStream) => void,
        private readonly onStatusChange: (status: ConnectionStatus) => void,
        private readonly onTimedOut: () => void = (): void => {},
        private readonly onRoomBusy: () => void = (): void => {},
    ) {}

    start(): void {
        this.onStatusChange('waiting')
        this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)
        this.join()
    }

    private join(): void {
        const room = joinRoom(buildRoomConfig(), this.roomCode)
        this.room = room

        room.makeAction<null>(ROOM_BUSY_ACTION).onMessage((_: null, { peerId }: { peerId: string }): void => {
            if (this.isFromHost(peerId)) {
                this.stop()
                this.onRoomBusy()
            }
        })

        room.makeAction<null>(STREAM_FAILED_ACTION).onMessage((_: null, { peerId }: { peerId: string }): void => {
            if (this.isFromHost(peerId)) {
                this.rejoin()
            }
        })

        room.onPeerStream((stream: MediaStream, { peerId }: { peerId: string }): void => {
            const hostPeerId = this.hostPeerId
            if (hostPeerId === null || peerId === hostPeerId) {
                this.acceptStream(stream, peerId)
                return
            }
            // A host that reloaded sends from a new peerId before its old one is reported gone.
            void isPeerAlive(room, hostPeerId).then((alive: boolean): void => {
                if (!alive && room === this.room) {
                    this.acceptStream(stream, peerId)
                }
            })
        })

        room.onPeerLeave(({ peerId }: { peerId: string }): void => {
            if (peerId !== this.hostPeerId) {
                return
            }
            this.hostPeerId = null
            this.onStatusChange('waiting')
            this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)
        })
    }

    // Before any stream the host is unknown, so its notices are accepted from any peer.
    private isFromHost(peerId: string): boolean {
        return this.hostPeerId === null || peerId === this.hostPeerId
    }

    private acceptStream(stream: MediaStream, peerId: string): void {
        this.hostPeerId = peerId
        this.graceTimeout.clear()
        this.onStream(stream)
        this.onStatusChange('connected')
    }

    // The host only sends a stream on join, so a fresh peerId is the only way to get another attempt.
    private rejoin(): void {
        if (this.hostPeerId !== null) {
            this.hostPeerId = null
            this.onStatusChange('waiting')
            this.graceTimeout.arm(SCREEN_SHARE_GRACE_TIMEOUT_MS)
        }
        this.room?.leave()
        this.join()
    }

    stop(): void {
        this.graceTimeout.clear()
        this.room?.leave()
        this.room = null
        this.hostPeerId = null
    }
}

function describeStatus(status: ConnectionStatus): string {
    switch (status) {
        case 'waiting':
            return I18n.t('screenShareViewer.statusWaiting')
        case 'connected':
            return ''
        case 'stopped':
            return I18n.t('screenShareViewer.statusStopped')
    }
}

// Bootstraps the read-only spectator page: a fullscreen <video> element plus a status banner.
export function initScreenShareViewer(roomCode: string, onClose: () => void): void {
    // Scoped to the viewer's own storage key, fully independent from the host app's theme.
    const viewerThemeService = new ThemeService(new Store(), VIEWER_THEME_STORAGE_KEY)
    viewerThemeService.getResolvedTheme()

    const container = document.createElement('div')
    container.className = 'screen-share-viewer'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'screen-share-viewer-close'
    closeBtn.textContent = '×'
    closeBtn.setAttribute('aria-label', I18n.t('screenShareViewer.closeAriaLabel'))

    const video = document.createElement('video')
    video.className = 'screen-share-viewer-video'
    video.autoplay = true
    video.playsInline = true
    video.muted = true

    const status = document.createElement('div')
    status.className = 'screen-share-viewer-status screen-share-viewer-status--visible'
    status.textContent = I18n.t('screenShareViewer.connecting')

    container.appendChild(closeBtn)
    container.appendChild(video)
    container.appendChild(status)
    document.body.appendChild(container)

    let viewer: ScreenShareViewer | null = null

    closeBtn.addEventListener('click', (): void => {
        viewer?.stop()
        container.remove()
        onClose()
    })

    if (!isWebRtcSupported()) {
        status.textContent = I18n.t('screenShareViewer.unsupported')
        return
    }

    // No translation describes a build misconfiguration, so the banner is hidden rather than misleading.
    if (!isRoomConfigValid()) {
        status.textContent = ''
        status.classList.remove('screen-share-viewer-status--visible')
        return
    }

    void isWebRtcBlocked(getIceServers()).then((blocked: boolean): void => {
        if (!container.isConnected) {
            return
        }
        if (blocked) {
            status.textContent = I18n.t('screenShareViewer.webRtcBlocked')
            return
        }
        viewer = new ScreenShareViewer(
            roomCode,
            (stream: MediaStream): void => {
                video.srcObject = stream
            },
            (status2: ConnectionStatus): void => {
                const message = describeStatus(status2)
                status.textContent = message
                status.classList.toggle('screen-share-viewer-status--visible', message.length > 0)
            },
            undefined,
            (): void => {
                status.textContent = I18n.t('screenShareViewer.roomBusy')
                status.classList.add('screen-share-viewer-status--visible')
            },
        )
        viewer.start()
    })
}
