import { generateRoomCode, RoomCodeStore, SharingActiveStore } from './room-code'
import { ScreenShareHost } from './screen-share-host'
import type { ActiveSession, ConnectionStatus, SharingState, SharingStatus } from '../../types/screen-share.types'

export const SCREEN_SHARE_FPS = 18

// Keyed by canvas; the room code and "was active" flag survive a refresh via localStorage.
const sessions = new WeakMap<HTMLCanvasElement, ActiveSession>()
const roomCodeStore = new RoomCodeStore()
const activeStore = new SharingActiveStore()

function getSession(canvas: HTMLCanvasElement): ActiveSession {
    const existing = sessions.get(canvas)
    if (existing) {
        return existing
    }
    const roomCode = roomCodeStore.load() ?? generateRoomCode()
    roomCodeStore.save(roomCode)
    const session: ActiveSession = { roomCode, host: null, status: 'inactive', listeners: new Set() }
    sessions.set(canvas, session)
    return session
}

function snapshot(session: ActiveSession): SharingState {
    return { roomCode: session.roomCode, status: session.status }
}

function notify(session: ActiveSession): void {
    const state = snapshot(session)
    for (const listener of session.listeners) {
        listener(state)
    }
}

function setStatus(session: ActiveSession, status: SharingStatus): void {
    session.status = status
    notify(session)
}

export function getSharingState(canvas: HTMLCanvasElement): SharingState {
    return snapshot(getSession(canvas))
}

export function subscribeToSharing(canvas: HTMLCanvasElement, listener: (state: SharingState) => void): () => void {
    const session = getSession(canvas)
    session.listeners.add(listener)
    return (): void => {
        session.listeners.delete(listener)
    }
}

export function activateSharing(canvas: HTMLCanvasElement): void {
    const session = getSession(canvas)
    if (session.host) {
        return
    }
    session.host = new ScreenShareHost(
        session.roomCode,
        canvas,
        SCREEN_SHARE_FPS,
        (status: ConnectionStatus): void => setStatus(session, status),
        (): void => {
            session.host = null
            activeStore.save(false)
        },
    )
    activeStore.save(true)
    session.host.start()
}

export function stopSharing(canvas: HTMLCanvasElement): void {
    const session = getSession(canvas)
    session.host?.stop()
    session.host = null
    activeStore.save(false)
    setStatus(session, 'inactive')
}

// The only place that changes the room code; only ever on an explicit host request.
export function regenerateSharingCode(canvas: HTMLCanvasElement): void {
    const session = getSession(canvas)
    const wasActive = session.host !== null
    session.host?.stop()
    session.host = null
    session.roomCode = generateRoomCode()
    roomCodeStore.save(session.roomCode)
    if (wasActive) {
        activateSharing(canvas)
    } else {
        setStatus(session, 'inactive')
    }
}

// Called at app boot to silently resume sharing after a host-side page refresh.
export function resumeSharingIfWasActive(canvas: HTMLCanvasElement): void {
    if (activeStore.load()) {
        activateSharing(canvas)
    }
}
