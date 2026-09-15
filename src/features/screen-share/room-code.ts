import { Store } from '../../shared/utils/store'
import { IStore } from '../../types/store.types'

const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const ROOM_CODE_LENGTH = 6

// Own key, separate from moodsort-card-state, so resetting card positions never touches an active share.
const STORAGE_KEY: string = 'moodsort-room-code'

// Lets a host-side page refresh silently resume the same session.
const ACTIVE_STORAGE_KEY: string = 'moodsort-sharing-active'

export function generateRoomCode(): string {
    let code = ''
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    }
    return code
}

export class RoomCodeStore {
    private store: IStore

    constructor(store: IStore = new Store()) {
        this.store = store
    }

    load(): string | null {
        return this.store.load<string>(STORAGE_KEY)
    }

    save(code: string): void {
        this.store.save<string>(STORAGE_KEY, code)
    }
}

export class SharingActiveStore {
    private store: IStore

    constructor(store: IStore = new Store()) {
        this.store = store
    }

    load(): boolean {
        return this.store.load<boolean>(ACTIVE_STORAGE_KEY) ?? false
    }

    save(active: boolean): void {
        this.store.save<boolean>(ACTIVE_STORAGE_KEY, active)
    }
}
