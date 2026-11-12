import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from 'trystero'
import { isPeerAlive } from '../features/screen-share/peer-liveness'

function roomPinging(ping: () => Promise<number>): Room {
    return { ping: vi.fn(ping) } as unknown as Room
}

describe('isPeerAlive', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('pings the given peer and reports it alive when it answers', async () => {
        const room = roomPinging((): Promise<number> => Promise.resolve(12))

        await expect(isPeerAlive(room, 'peer-1')).resolves.toBe(true)
        expect(room.ping).toHaveBeenCalledWith('peer-1')
    })

    it('reports a peer whose ping fails as gone', async () => {
        await expect(isPeerAlive(roomPinging((): Promise<number> => Promise.reject(new Error('closed'))), 'peer-1')).resolves.toBe(false)
    })

    it('reports a peer whose ping never answers within 3 seconds as gone', async () => {
        const result = isPeerAlive(roomPinging((): Promise<number> => new Promise((): void => {})), 'peer-1')

        await vi.advanceTimersByTimeAsync(3000)

        await expect(result).resolves.toBe(false)
    })
})
