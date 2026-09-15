import type { ScreenShareHost } from '../features/screen-share/screen-share-host'

// 'waiting' covers both "no viewer yet" and "viewer disconnected", bounded by the grace timeout.
export type ConnectionStatus = 'waiting' | 'connected' | 'stopped'

export type SharingStatus = 'inactive' | ConnectionStatus

export interface SharingState {
    roomCode: string
    status: SharingStatus
}

export interface ActiveSession {
    roomCode: string
    host: ScreenShareHost | null
    status: SharingStatus
    listeners: Set<(state: SharingState) => void>
}

export interface TurnServerConfig {
    urls: string | string[]
    username: string
    credential: string
}
