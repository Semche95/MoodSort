import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasTooltip } from '../shared/ui/canvas-tooltip'
import { createButton, createCircleView, createLogo, createShareButton, setButtonEnabled } from '../features/toolbar/toolbar-view'

const { pixi, ui, buttons } = vi.hoisted(() => {
    class Container {
        label: string = ''
        x: number = 0
        y: number = 0
        children: unknown[] = []
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        addChild(child: unknown): unknown {
            this.children.push(child)
            return child
        }
    }

    class Graphics extends Container {
        fillAlpha: number = 0
        fillColor: number | undefined
        strokeColor: number | undefined
        visible: boolean = true
        circle(): this {
            return this
        }
        roundRect(): this {
            return this
        }
        clear(): this {
            return this
        }
        fill(options: { alpha?: number; color?: number } = {}): this {
            this.fillAlpha = options.alpha ?? 1
            this.fillColor = options.color
            return this
        }
        stroke(options: { color?: number } = {}): this {
            this.strokeColor = options.color
            return this
        }
    }

    class Text extends Container {
        anchor: { x: number; y: number; set(x: number, y: number): void } = {
            x: 0,
            y: 0,
            set: (x: number, y: number): void => {
                this.anchor.x = x
                this.anchor.y = y
            },
        }
        text: unknown
        style: Record<string, unknown>
        constructor(options: { text?: unknown; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text
            this.style = options.style ?? {}
        }
    }

    const buttons: FancyButton[] = []

    class FancyButton {
        enabled: boolean = true
        label: string = ''
        x: number = 10
        y: number = 20
        iconView: unknown = null
        innerView: { addChild(child: unknown): unknown } = { addChild: (child: unknown): unknown => child }
        options: Record<string, unknown>
        private onPressCallback: (() => void) | null = null
        private onHoverCallback: (() => void) | null = null
        private onOutCallback: (() => void) | null = null
        onPress: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onPressCallback = fn
            },
        }
        onHover: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onHoverCallback = fn
            },
        }
        onOut: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onOutCallback = fn
            },
        }
        constructor(options: Record<string, unknown> = {}) {
            this.options = options
            this.iconView = options.icon
            buttons.push(this)
        }
        press(): void {
            this.onPressCallback?.()
        }
        hover(): void {
            this.onHoverCallback?.()
        }
        out(): void {
            this.onOutCallback?.()
        }
    }

    class Sprite extends Container {
        scale: { set(v: number): void } = { set: (): void => {} }
        anchor: { set(x: number, y: number): void } = { set: (): void => {} }
        tint: number = 0
        height: number = 20
    }

    return {
        pixi: { Container, Graphics, Text, Sprite },
        ui: { FancyButton },
        buttons,
    }
})

vi.mock('pixi.js', () => ({ ...pixi }))
vi.mock('@pixi/ui', () => ({ FancyButton: ui.FancyButton }))

function createFakeTooltip(): CanvasTooltip {
    return { show: vi.fn(), hide: vi.fn() } as unknown as CanvasTooltip
}

describe('toolbar-view', () => {
    beforeEach(() => {
        buttons.length = 0
    })

    it('draws a filled circle at the button size', () => {
        const view = createCircleView(0xffffff, 0.85) as unknown as { fillAlpha: number }

        expect(view.fillAlpha).toBe(0.85)
    })

    it('builds a logo with the emoji and MoodSort title aligned on the same baseline', () => {
        const logo = createLogo() as unknown as { children: Array<{ text: unknown; anchor: { x: number; y: number }; y: number }> }
        const [emoji, title] = logo.children

        expect(emoji.text).toBe('🎭')
        expect(title.text).toBe('MoodSort')
        expect(emoji.anchor.x).toBe(0)
        expect(emoji.anchor.y).toBe(0.5)
        expect(title.anchor.y).toBe(0.5)
        expect(emoji.y).toBe(title.y)
    })

    it('enables a button and restores full icon opacity', () => {
        const tooltip = createFakeTooltip()
        const button = new ui.FancyButton() as unknown as { enabled: boolean }
        const icon = { alpha: 0.35 }

        setButtonEnabled(button as never, icon as never, true, tooltip)

        expect(button.enabled).toBe(true)
        expect(icon.alpha).toBe(1)
        expect(tooltip.hide).not.toHaveBeenCalled()
    })

    it('disables a button, dims its icon, and hides any visible tooltip', () => {
        const tooltip = createFakeTooltip()
        const button = new ui.FancyButton() as unknown as { enabled: boolean }
        const icon = { alpha: 1 }

        setButtonEnabled(button as never, icon as never, false, tooltip)

        expect(button.enabled).toBe(false)
        expect(icon.alpha).toBe(0.35)
        expect(tooltip.hide).toHaveBeenCalledOnce()
    })

    it('creates a button that fires onClick and hides the tooltip on press', () => {
        const tooltip = createFakeTooltip()
        const onClick = vi.fn()

        const button = createButton(tooltip, new pixi.Container() as never, onClick, 'my-button', 'My label')

        expect(button.label).toBe('my-button')
        ;(button as unknown as { press(): void }).press()
        expect(onClick).toHaveBeenCalledOnce()
        expect(tooltip.hide).toHaveBeenCalledOnce()
    })

    it('shows the tooltip below the button on hover, and hides it on pointer out', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label')
        const fake = button as unknown as { hover(): void; out(): void; x: number; y: number }

        fake.hover()
        expect(tooltip.show).toHaveBeenCalledWith(fake.x, fake.y + 48 / 2 + 8, 'My label')

        fake.out()
        expect(tooltip.hide).toHaveBeenCalled()
    })

    it('shows the current accessible title on hover when it was changed after creation', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label')
        const fake = button as unknown as { hover(): void; accessibleTitle: string; x: number; y: number }
        fake.accessibleTitle = 'Updated label'

        fake.hover()
        expect(tooltip.show).toHaveBeenCalledWith(fake.x, fake.y + 48 / 2 + 8, 'Updated label')
    })

    it('defaults the icon scale to roughly a third of the button size, unless overridden', () => {
        const tooltip = createFakeTooltip()

        const defaultScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'a', 'A') as unknown as { options: Record<string, unknown> }
        const overriddenScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'b', 'B', 1) as unknown as { options: Record<string, unknown> }

        expect(defaultScale.options.defaultIconScale).toBeCloseTo(22 / 64)
        expect(overriddenScale.options.defaultIconScale).toBe(1)
    })

    it('fills the logo emoji and title with the dark theme palette when built for the dark theme', () => {
        const logo = createLogo('dark') as unknown as { children: Array<{ style: { fill?: number } }> }
        const [emoji, title] = logo.children

        expect(emoji.style.fill).toBe(0xf2f2f2)
        expect(title.style.fill).toBe(0xf0f0f0)
    })

    it('draws button state views with the dark theme palette when built for the dark theme', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label', undefined, 'dark') as unknown as {
            options: { defaultView: { fillColor: number }; hoverView: { fillColor: number }; pressedView: { fillColor: number }; disabledView: { fillColor: number } }
        }

        expect(button.options.defaultView.fillColor).toBe(0x76767f)
        expect(button.options.hoverView.fillColor).toBe(0x82828c)
        expect(button.options.pressedView.fillColor).toBe(0x44444c)
        expect(button.options.disabledView.fillColor).toBe(0x76767f)
    })

    it('tints the share button icon and its status dots with the dark theme palette', () => {
        const tooltip = createFakeTooltip()
        const icon = new pixi.Sprite() as unknown as { tint: number }

        const { activeIndicator, viewerIndicator } = createShareButton(tooltip, icon as never, vi.fn(), 'Share', 'Share', 'dark')

        expect(icon.tint).toBe(0xffffff)
        expect((activeIndicator as unknown as { strokeColor: number }).strokeColor).toBe(0x1a1a1a)
        expect((viewerIndicator as unknown as { strokeColor: number }).strokeColor).toBe(0x1a1a1a)
    })
})
