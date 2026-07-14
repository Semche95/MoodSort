const STORAGE_KEY: string = 'moodsort-onboarding-dismissed'

export interface IOnboardingStore {
    isDismissed(): boolean
    dismiss(): void
}

export class OnboardingStore implements IOnboardingStore {
    isDismissed(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true'
        } catch {
            return false
        }
    }

    dismiss(): void {
        try {
            localStorage.setItem(STORAGE_KEY, 'true')
        } catch {
            // localStorage unavailable
        }
    }
}

export class InMemoryOnboardingStore implements IOnboardingStore {
    private dismissed: boolean = false

    isDismissed(): boolean {
        return this.dismissed
    }

    dismiss(): void {
        this.dismissed = true
    }
}
