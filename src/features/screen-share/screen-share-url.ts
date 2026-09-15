const ROOM_HASH_PATTERN = /^#room=([A-Za-z0-9]{6})$/

export function buildRoomUrl(roomCode: string, href: string = window.location.href): string {
    const url = new URL(href)
    url.hash = `room=${roomCode}`
    return url.toString()
}

export function getRoomCodeFromHash(hash: string): string | null {
    const match = ROOM_HASH_PATTERN.exec(hash)
    return match ? match[1] : null
}
