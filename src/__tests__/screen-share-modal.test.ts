import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createScreenShareModal } from '../features/screen-share/screen-share-modal'

const { joinRoom, rooms } = vi.hoisted(() => {
    const rooms: Array<{ leave: ReturnType<typeof vi.fn>; addStream: ReturnType<typeof vi.fn>; makeAction: ReturnType<typeof vi.fn>; onPeerJoin: unknown; onPeerLeave: unknown }> = []
    const joinRoom = vi.fn(() => {
        const room = { leave: vi.fn(), addStream: vi.fn(), makeAction: vi.fn(() => ({ send: vi.fn(), onMessage: null })), onPeerJoin: null, onPeerLeave: null }
        rooms.push(room)
        return room
    })
    return { joinRoom, rooms }
})

vi.mock('trystero', () => ({ joinRoom }))

function createFakeCanvas(): HTMLCanvasElement {
    return document.createElement('canvas')
}

function extractRoomCode(url: string): string {
    return url.match(/#room=([A-Z0-9]+)/)![1]
}

function activate(overlay: HTMLDivElement): void {
    overlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.click()
}

const localStorageMock: Record<string, string> = {}

describe('createScreenShareModal', () => {
    beforeEach(() => {
        rooms.length = 0
        joinRoom.mockClear()
        Object.keys(localStorageMock).forEach((key: string) => delete localStorageMock[key])
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: vi.fn((key: string): string | null => localStorageMock[key] ?? null),
                setItem: vi.fn((key: string, value: string): void => { localStorageMock[key] = value }),
                removeItem: vi.fn((key: string): void => { delete localStorageMock[key] }),
                clear: vi.fn((): void => { Object.keys(localStorageMock).forEach((k: string) => delete localStorageMock[k]) }),
            },
            writable: true,
            configurable: true,
        })
        const patchedGlobal = globalThis as { RTCPeerConnection?: unknown }
        patchedGlobal.RTCPeerConnection = class {}
        HTMLCanvasElement.prototype.captureStream = vi.fn((): MediaStream => ({
            getTracks: (): MediaStreamTrack[] => [],
            getVideoTracks: (): MediaStreamTrack[] => [{ contentHint: '' } as MediaStreamTrack],
        }) as MediaStream)
    })

    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'RTCPeerConnection')
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
    })

    it('shows the "Activer le partage" button and no link before sharing is activated', () => {
        const overlay = createScreenShareModal(createFakeCanvas())

        expect(overlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.hidden).toBe(false)
        expect(overlay.querySelector('.screen-share-live')!.classList.contains('screen-share-live--visible')).toBe(false)
        expect(joinRoom).not.toHaveBeenCalled()
    })

    it('starts the host and shows the room link once "Activer le partage" is clicked', () => {
        const overlay = createScreenShareModal(createFakeCanvas())

        activate(overlay)

        const urlInput = overlay.querySelector<HTMLInputElement>('.screen-share-url')!
        expect(urlInput.value).toMatch(/#room=[A-Z0-9]{6}$/)
        const code = extractRoomCode(urlInput.value)
        expect(joinRoom).toHaveBeenCalledWith(expect.objectContaining({ appId: expect.any(String) }), code)
        expect(overlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.hidden).toBe(true)
        expect(overlay.querySelector('.screen-share-live')!.classList.contains('screen-share-live--visible')).toBe(true)
    })

    it('closes the dialog without stopping an active share when the close button is pressed', () => {
        const overlay = createScreenShareModal(createFakeCanvas())
        document.body.appendChild(overlay)
        activate(overlay)

        overlay.querySelector<HTMLButtonElement>('.screen-share-close')!.click()

        expect(document.body.contains(overlay)).toBe(false)
        expect(rooms[0].leave).not.toHaveBeenCalled()
    })

    it('reflects the already-active session, with the same code, when reopened after closing', () => {
        const canvas = createFakeCanvas()
        const firstOverlay = createScreenShareModal(canvas)
        document.body.appendChild(firstOverlay)
        activate(firstOverlay)
        const firstCode = extractRoomCode(firstOverlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)

        firstOverlay.querySelector<HTMLButtonElement>('.screen-share-close')!.click()

        const secondOverlay = createScreenShareModal(canvas)
        document.body.appendChild(secondOverlay)

        expect(secondOverlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.hidden).toBe(true)
        const secondCode = extractRoomCode(secondOverlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)
        expect(secondCode).toBe(firstCode)
        expect(joinRoom).toHaveBeenCalledTimes(1)
    })

    it('leaves sharing inactive for a brand new canvas until explicitly activated, simulating a page reload', () => {
        const firstOverlay = createScreenShareModal(createFakeCanvas())
        activate(firstOverlay)
        const firstCode = extractRoomCode(firstOverlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)

        const secondOverlay = createScreenShareModal(createFakeCanvas())

        expect(secondOverlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.hidden).toBe(false)
        expect(extractRoomCode(secondOverlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)).toBe(firstCode)
    })

    it('stops sharing without regenerating the code when "Arrêter le partage" is clicked', () => {
        const overlay = createScreenShareModal(createFakeCanvas())
        activate(overlay)
        const firstCode = extractRoomCode(overlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)

        overlay.querySelector<HTMLButtonElement>('.screen-share-stop')!.click()

        expect(rooms[0].leave).toHaveBeenCalledOnce()
        expect(overlay.querySelector<HTMLButtonElement>('.screen-share-activate')!.hidden).toBe(false)
        expect(extractRoomCode(overlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)).toBe(firstCode)
    })

    it('replaces the room code, leaves the old room and joins a new one when "Générer un nouveau code" is clicked', () => {
        const overlay = createScreenShareModal(createFakeCanvas())
        activate(overlay)
        const urlInput = overlay.querySelector<HTMLInputElement>('.screen-share-url')!
        const firstCode = extractRoomCode(urlInput.value)

        overlay.querySelector<HTMLButtonElement>('.screen-share-regenerate')!.click()

        const secondCode = extractRoomCode(urlInput.value)

        expect(secondCode).not.toBe(firstCode)
        expect(rooms[0].leave).toHaveBeenCalled()
        expect(joinRoom).toHaveBeenCalledTimes(2)
        expect(joinRoom).toHaveBeenLastCalledWith(expect.objectContaining({ appId: expect.any(String) }), secondCode)
    })

    it('does not regenerate the room code when the dialog is reset by clearing card positions', () => {
        localStorage.setItem('moodsort-card-state', JSON.stringify({ positions: {}, order: [], onboardingDismissed: false, stackNames: {} }))
        const overlay = createScreenShareModal(createFakeCanvas())
        const firstCode = extractRoomCode(overlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)

        localStorage.setItem('moodsort-card-state', JSON.stringify({ positions: {}, order: [], onboardingDismissed: false, stackNames: {} }))

        const secondOverlay = createScreenShareModal(createFakeCanvas())
        const secondCode = extractRoomCode(secondOverlay.querySelector<HTMLInputElement>('.screen-share-url')!.value)

        expect(secondCode).toBe(firstCode)
    })

    it('closes when clicking the backdrop but not when clicking the modal itself', () => {
        const overlay = createScreenShareModal(createFakeCanvas())
        document.body.appendChild(overlay)

        overlay.querySelector('.screen-share-modal')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(document.body.contains(overlay)).toBe(true)

        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(document.body.contains(overlay)).toBe(false)
    })

    it('shows an error when the clipboard API is unavailable', async () => {
        const originalClipboard = navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })

        const overlay = createScreenShareModal(createFakeCanvas())
        activate(overlay)
        overlay.querySelector<HTMLButtonElement>('.screen-share-copy')!.click()

        expect(overlay.querySelector('.screen-share-copy-feedback')!.textContent).toMatch(/not available/i)

        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
    })

    it('copies the room URL to the clipboard when available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

        const overlay = createScreenShareModal(createFakeCanvas())
        activate(overlay)
        const urlInput = overlay.querySelector<HTMLInputElement>('.screen-share-url')!
        overlay.querySelector<HTMLButtonElement>('.screen-share-copy')!.click()
        await Promise.resolve()

        expect(writeText).toHaveBeenCalledWith(urlInput.value)
    })
})
