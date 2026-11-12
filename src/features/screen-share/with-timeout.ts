// Settles like `promise`, or rejects once `ms` elapse first; the timer never outlives the settlement.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve: (value: T) => void, reject: (error: unknown) => void): void => {
        const timeout = setTimeout((): void => reject(new Error(`Timed out after ${ms} ms`)), ms)
        promise.then(
            (value: T): void => {
                clearTimeout(timeout)
                resolve(value)
            },
            (error: unknown): void => {
                clearTimeout(timeout)
                reject(error)
            },
        )
    })
}
