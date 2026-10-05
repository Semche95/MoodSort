import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRoomConfig, getIceServers, isRoomConfigValid, parseUrlList, SCREEN_SHARE_APP_ID } from '../features/screen-share/room-config'

describe('parseUrlList', () => {
    it('returns an empty list for an absent or empty value', () => {
        expect(parseUrlList(undefined, ['wss:'], 'VAR')).toEqual([])
        expect(parseUrlList('', ['wss:'], 'VAR')).toEqual([])
    })

    it('trims spaces around entries and drops empty ones', () => {
        expect(parseUrlList(' wss://a.test , ,wss://b.test,', ['ws:', 'wss:'], 'VAR')).toEqual(['wss://a.test', 'wss://b.test'])
    })

    it('throws, naming the variable and the entry, when an entry has the wrong scheme', () => {
        expect(() => parseUrlList('wss://a.test,https://b.test', ['ws:', 'wss:'], 'VITE_SIGNALING_RELAYS'))
            .toThrow('VITE_SIGNALING_RELAYS: invalid entry "https://b.test", expected "ws:" or "wss:" URL')
    })
})

describe('buildRoomConfig', () => {
    it('keeps Trystero default relays and STUN servers when no variable is set', () => {
        expect(buildRoomConfig({})).toEqual({ appId: SCREEN_SHARE_APP_ID, relayConfig: { redundancy: 5 } })
    })

    it('replaces the default relays when VITE_SIGNALING_RELAYS is set', () => {
        const config = buildRoomConfig({ VITE_SIGNALING_RELAYS: 'wss://a.test, ws://b.test' })

        expect(config.relayConfig?.urls).toEqual(['wss://a.test', 'ws://b.test'])
        expect(config.rtcConfig).toBeUndefined()
    })

    it.each([
        [1, 1],
        [3, 3],
        [8, 5],
    ])('caps the redundancy to the number of relays provided (%i relays gives %i)', (relayCount: number, redundancy: number) => {
        const relays = Array.from({ length: relayCount }, (_: unknown, index: number): string => `wss://relay${index}.test`)

        expect(buildRoomConfig({ VITE_SIGNALING_RELAYS: relays.join(',') }).relayConfig?.redundancy).toBe(redundancy)
    })

    it('puts only the STUN servers in rtcConfig.iceServers when VITE_STUN_URLS is set', () => {
        const config = buildRoomConfig({ VITE_STUN_URLS: 'stun:a.test:3478, stuns:b.test:5349' })

        expect(config).toEqual({
            appId: SCREEN_SHARE_APP_ID,
            relayConfig: { redundancy: 5 },
            rtcConfig: { iceServers: [{ urls: ['stun:a.test:3478', 'stuns:b.test:5349'] }] },
        })
    })

    it('throws instead of falling back to the defaults when a relay or STUN entry has the wrong scheme', () => {
        expect(() => buildRoomConfig({ VITE_SIGNALING_RELAYS: 'https://a.test' })).toThrow('VITE_SIGNALING_RELAYS')
        expect(() => buildRoomConfig({ VITE_STUN_URLS: 'http://a.test' })).toThrow('VITE_STUN_URLS')
    })

    it('reads import.meta.env when called without an argument', () => {
        vi.stubEnv('VITE_SIGNALING_RELAYS', 'wss://env.test')

        expect(buildRoomConfig().relayConfig?.urls).toEqual(['wss://env.test'])
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })
})

describe('getIceServers', () => {
    it('falls back to STUN servers when VITE_STUN_URLS is not set, since an empty list would suppress every remote candidate', () => {
        const iceServers = getIceServers({})

        expect(iceServers.length).toBeGreaterThan(0)
        expect(iceServers.every((server: RTCIceServer): boolean => String(server.urls).startsWith('stun:'))).toBe(true)
    })

    it('returns the configured STUN servers when VITE_STUN_URLS is set', () => {
        expect(getIceServers({ VITE_STUN_URLS: 'stun:a.test:3478' })).toEqual([{ urls: ['stun:a.test:3478'] }])
    })
})

describe('isRoomConfigValid', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns true without logging for a valid configuration', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation((): void => {})

        expect(isRoomConfigValid({ VITE_STUN_URLS: 'stun:a.test' })).toBe(true)
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('returns false and logs the variable, the faulty entry and the expected format for an invalid configuration', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation((): void => {})

        expect(isRoomConfigValid({ VITE_STUN_URLS: 'stun:ok.test, http://x' })).toBe(false)
        expect(consoleError).toHaveBeenCalledWith(
            'Screen sharing disabled, invalid signaling configuration: VITE_STUN_URLS: invalid entry "http://x", expected "stun:" or "stuns:" URL',
        )
    })
})
