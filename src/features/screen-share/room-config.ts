import type { TurnServerConfig } from '../../types/screen-share.types'

export const SCREEN_SHARE_APP_ID = 'moodsort-screen-share'

// Trystero action namespace the host uses to reject a second viewer (only one spectator per session).
export const ROOM_BUSY_ACTION = 'room-busy'

// How long either side waits with no active peer before tearing the session down.
export const SCREEN_SHARE_GRACE_TIMEOUT_MS = 10 * 60 * 1000

// More relays than Trystero's default gives the signaling handshake more chances to succeed.
const RELAY_REDUNDANCY = 5

// Optional TURN server for peers behind restrictive NATs, where WebRTC ICE negotiation
// would otherwise fail. Set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL to enable.
function getTurnConfig(): TurnServerConfig[] | undefined {
    const url = import.meta.env.VITE_TURN_URL
    const username = import.meta.env.VITE_TURN_USERNAME
    const credential = import.meta.env.VITE_TURN_CREDENTIAL
    if (!url || !username || !credential) {
        return undefined
    }
    return [{ urls: url, username, credential }]
}

export function buildRoomConfig(): {
    appId: string
    relayConfig: { redundancy: number }
    turnConfig?: TurnServerConfig[]
} {
    const turnConfig = getTurnConfig()
    return {
        appId: SCREEN_SHARE_APP_ID,
        relayConfig: { redundancy: RELAY_REDUNDANCY },
        ...(turnConfig ? { turnConfig } : {}),
    }
}
