// Shared "give up if nobody reconnects in time" timer for host and viewer.
// Arming cancels any previous timeout first, so repeated arms just push the deadline back.
export class GraceTimeout {
    private timeout: ReturnType<typeof setTimeout> | null = null

    constructor(private readonly onElapsed: () => void) {}

    arm(ms: number): void {
        this.clear()
        this.timeout = setTimeout(this.onElapsed, ms)
    }

    clear(): void {
        if (this.timeout !== null) {
            clearTimeout(this.timeout)
            this.timeout = null
        }
    }
}
