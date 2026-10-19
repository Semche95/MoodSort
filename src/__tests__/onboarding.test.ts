import { describe, it, expect, vi, afterEach } from 'vitest'
import { initOnboarding, isOnboardingDismissed } from '../features/onboarding/onboarding'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'

function makeStore(onboardingDismissed: boolean): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({ positions: {}, order: [], onboardingDismissed, stackNames: {} })
    return store
}

describe('initOnboarding', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('neither shows the onboarding nor fires the callback on later visits', () => {
        const onFirstDismiss = vi.fn()

        initOnboarding(makeStore(true), onFirstDismiss)

        expect(onFirstDismiss).not.toHaveBeenCalled()
        expect(document.querySelector('.onboarding-overlay')).toBeNull()
    })

    it('fires the callback only once a first-time visitor dismisses the onboarding', () => {
        const store = makeStore(false)
        const onFirstDismiss = vi.fn()

        initOnboarding(store, onFirstDismiss)
        expect(onFirstDismiss).not.toHaveBeenCalled()

        document.querySelector<HTMLButtonElement>('.onboarding-dismiss')!.click()

        expect(onFirstDismiss).toHaveBeenCalledOnce()
        expect(isOnboardingDismissed(store)).toBe(true)
        expect(document.querySelector('.onboarding-overlay')).toBeNull()
    })

    it('does not stack a second overlay over one already open', () => {
        document.body.appendChild(Object.assign(document.createElement('div'), { className: 'onboarding-overlay' }))

        initOnboarding(makeStore(false), vi.fn())

        expect(document.querySelectorAll('.onboarding-overlay')).toHaveLength(1)
    })
})
