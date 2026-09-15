import { describe, expect, it } from 'vitest'
import { ROOM_CODE_LENGTH, RoomCodeStore, SharingActiveStore, generateRoomCode } from '../features/screen-share/room-code'
import { InMemoryStore } from './in-memory-store'

describe('generateRoomCode', () => {
    it('generates a 6 character alphanumeric code', () => {
        const code = generateRoomCode()

        expect(code).toHaveLength(ROOM_CODE_LENGTH)
        expect(code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('generates different codes across calls', () => {
        const codes = new Set(Array.from({ length: 20 }, (): string => generateRoomCode()))

        expect(codes.size).toBeGreaterThan(1)
    })
})

describe('RoomCodeStore', () => {
    it('returns null when no code was ever saved', () => {
        expect(new RoomCodeStore(new InMemoryStore()).load()).toBeNull()
    })

    it('persists a saved code under its own key, independent from any other store instance', () => {
        const store = new InMemoryStore()
        new RoomCodeStore(store).save('ABC123')

        expect(new RoomCodeStore(store).load()).toBe('ABC123')
        expect(store.load('moodsort-card-state')).toBeNull()
    })
})

describe('SharingActiveStore', () => {
    it('defaults to false when nothing was ever saved', () => {
        expect(new SharingActiveStore(new InMemoryStore()).load()).toBe(false)
    })

    it('persists whether sharing was explicitly activated, under its own key', () => {
        const store = new InMemoryStore()
        new SharingActiveStore(store).save(true)

        expect(new SharingActiveStore(store).load()).toBe(true)
        expect(store.load('moodsort-room-code')).toBeNull()
    })
})
