import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHelpModal, createOnboarding, initOnboarding, isOnboardingDismissed } from '../features/onboarding/onboarding'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'

function makeStore(onboardingDismissed: boolean): CardStateService {
    const store = new CardStateService(new InMemoryStore())
    store.save({ positions: {}, order: [], onboardingDismissed, stackNames: {}, viewport: null })
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

    it('keeps the saved layout when a first-time visitor dismisses the onboarding', () => {
        const store = new CardStateService(new InMemoryStore())
        const layout = {
            positions: { a: { x: 1, y: 2 } },
            order: ['a'],
            stackNames: { a: 'Joy' },
            viewport: { width: 1600, height: 900 },
        }
        store.save({ ...layout, onboardingDismissed: false })

        initOnboarding(store, vi.fn())
        document.querySelector<HTMLButtonElement>('.onboarding-dismiss')!.click()

        expect(store.load('positions')).toEqual(layout.positions)
        expect(store.load('order')).toEqual(layout.order)
        expect(store.load('stackNames')).toEqual(layout.stackNames)
        expect(store.load('viewport')).toEqual(layout.viewport)
    })

    it('does not stack a second overlay over one already open', () => {
        document.body.appendChild(Object.assign(document.createElement('div'), { className: 'onboarding-overlay' }))

        initOnboarding(makeStore(false), vi.fn())

        expect(document.querySelectorAll('.onboarding-overlay')).toHaveLength(1)
    })
})

describe('createOnboarding', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('stays open when clicking the backdrop', () => {
        const onDismiss = vi.fn()
        const overlay = document.body.appendChild(createOnboarding(onDismiss))

        overlay.click()

        expect(onDismiss).not.toHaveBeenCalled()
        expect(overlay.isConnected).toBe(true)
    })

    it('has no close cross', () => {
        expect(createOnboarding(vi.fn()).querySelector('.onboarding-close')).toBeNull()
    })

    it('titles the welcome with the app name, its first half accented', () => {
        const title = createOnboarding(vi.fn()).querySelector('h1')!

        expect(title.textContent).toBe('Welcome to MoodSort')
        expect(title.querySelector('.brand-accent')!.textContent).toBe('Mood')
    })
})

describe('createHelpModal', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('has no dismiss button', () => {
        expect(createHelpModal().querySelector('.onboarding-dismiss')).toBeNull()
    })

    it('closes when clicking the close cross', () => {
        const overlay = document.body.appendChild(createHelpModal())

        overlay.querySelector<HTMLButtonElement>('.onboarding-close')!.click()

        expect(overlay.isConnected).toBe(false)
    })

    it('closes when clicking the backdrop', () => {
        const overlay = document.body.appendChild(createHelpModal())

        overlay.click()

        expect(overlay.isConnected).toBe(false)
    })

    it('stays open when clicking inside the card', () => {
        const overlay = document.body.appendChild(createHelpModal())

        overlay.querySelector<HTMLElement>('.onboarding-card')!.click()

        expect(overlay.isConnected).toBe(true)
    })
})
