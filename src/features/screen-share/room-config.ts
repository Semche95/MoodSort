import type { JoinRoomConfig } from 'trystero'
import type { SignalingEnv } from '../../types/screen-share.types'

export const SCREEN_SHARE_APP_ID = 'moodsort-screen-share'

// Trystero action namespace the host uses to reject a second viewer (only one spectator per session).
export const ROOM_BUSY_ACTION = 'room-busy'

// How long either side waits with no active peer before tearing the session down.
export const SCREEN_SHARE_GRACE_TIMEOUT_MS = 10 * 60 * 1000

// More relays than Trystero's default gives the signaling handshake more chances to succeed.
const RELAY_REDUNDANCY = 5

const RELAY_SCHEMES = ['ws:', 'wss:']
const STUN_SCHEMES = ['stun:', 'stuns:']

export function parseUrlList(value: string | undefined, schemes: string[], variableName: string): string[] {
    const entries = (value ?? '').split(',').map((entry: string): string => entry.trim()).filter((entry: string): boolean => entry.length > 0)
    for (const entry of entries) {
        if (!schemes.some((scheme: string): boolean => entry.startsWith(scheme))) {
            const expected = schemes.map((scheme: string): string => `"${scheme}"`).join(' or ')
            throw new Error(`${variableName}: invalid entry "${entry}", expected ${expected} URL`)
        }
    }
    return entries
}

// Throws on a misconfigured URL rather than silently falling back to Trystero's default servers.
export function buildRoomConfig(env: SignalingEnv = import.meta.env): JoinRoomConfig {
    const relayUrls = parseUrlList(env.VITE_SIGNALING_RELAYS, RELAY_SCHEMES, 'VITE_SIGNALING_RELAYS')
    const stunUrls = parseUrlList(env.VITE_STUN_URLS, STUN_SCHEMES, 'VITE_STUN_URLS')
    return {
        appId: SCREEN_SHARE_APP_ID,
        relayConfig: relayUrls.length > 0
            ? { redundancy: Math.min(RELAY_REDUNDANCY, relayUrls.length), urls: relayUrls }
            : { redundancy: RELAY_REDUNDANCY },
        ...(stunUrls.length > 0 ? { rtcConfig: { iceServers: [{ urls: stunUrls }] } } : {}),
    }
}

export function isRoomConfigValid(env: SignalingEnv = import.meta.env): boolean {
    try {
        buildRoomConfig(env)
        return true
    } catch (error) {
        console.error(`Screen sharing disabled, invalid signaling configuration: ${error instanceof Error ? error.message : String(error)}`)
        return false
    }
}
