import type { Room } from 'trystero'
import { withTimeout } from './with-timeout'

const PEER_PING_TIMEOUT_MS = 3000

// A peer whose tab reloaded stays listed until WebRTC notices the dead connection, but no longer answers a ping.
export function isPeerAlive(room: Room, peerId: string): Promise<boolean> {
    return withTimeout(room.ping(peerId), PEER_PING_TIMEOUT_MS).then((): boolean => true, (): boolean => false)
}
