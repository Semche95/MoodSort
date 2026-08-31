import { Container, Graphics, Text } from 'pixi.js'

const PADDING_X = 8
const PADDING_Y = 5
const RADIUS = 6
// Matches LABEL_FONT_SIZE in stack-overlay.ts, so the editable field reads at
// the same size as the label it's editing instead of popping up noticeably smaller.
const FONT_SIZE = 20
const BG_COLOR = 0x222222
const BG_ALPHA = 0.95
const TEXT_COLOR = 0xffffff
const BORDER_COLOR = 0x6699ff
const FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const MAX_NAME_LENGTH = 24
const CURSOR_WIDTH = 2
const CURSOR_BLINK_INTERVAL_MS = 500

/**
 * Canvas-rendered inline text field for naming a stack. The visible text,
 * caret and selection highlight are all drawn as Pixi objects, exactly like
 * the rest of the sort UI. Keystrokes, caret movement, selection, native
 * copy/paste and IME composition are captured through a real `<input>`
 * element that is kept off-screen and invisible (opacity 0, positioned
 * outside the viewport) for the lifetime of the edit and removed again on
 * close: it never renders anything itself, it only exists so the browser's
 * native text-editing behavior (arrow keys, Home/End, Ctrl/Cmd+A, paste,
 * IME) can drive `buffer`/`cursorPos`/`selectionStart`, which are then
 * mirrored into the Pixi display.
 */
export class StackNameEditor {
    readonly view: Container
    private readonly bg: Graphics
    private readonly selectionHighlight: Graphics
    private readonly text: Text
    private readonly cursor: Graphics
    private readonly measurer: Text
    private buffer: string
    private cursorPos: number
    private selectionStart: number | null
    private open_: boolean
    private cursorVisible: boolean
    private blinkTimer: ReturnType<typeof setInterval> | null
    private onCommit: ((value: string) => void) | null
    private onCancel: (() => void) | null
    private input: HTMLInputElement | null
    private boundKeyDown: (e: KeyboardEvent) => void
    private boundSync: () => void

    constructor() {
        this.view = new Container()
        this.view.label = 'stack-name-editor'
        this.view.visible = false
        this.view.eventMode = 'none'

        this.bg = new Graphics()
        this.bg.label = 'stack-name-editor-bg'

        this.selectionHighlight = new Graphics()
        this.selectionHighlight.label = 'stack-name-editor-selection'

        this.text = new Text({
            text: '',
            style: {
                fontFamily: FONT_FAMILY,
                fontSize: FONT_SIZE,
                fill: TEXT_COLOR,
            },
        })
        this.text.label = 'stack-name-editor-text'

        this.cursor = new Graphics()
        this.cursor.label = 'stack-name-editor-cursor'

        // Off-view, never added to `view`: used only to measure the pixel width of a
        // substring (e.g. "up to the cursor"), so the cursor/selection can be
        // positioned without disturbing what's actually drawn as `this.text`.
        this.measurer = new Text({
            text: '',
            style: { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, fill: TEXT_COLOR },
        })

        this.view.addChild(this.bg)
        this.view.addChild(this.selectionHighlight)
        this.view.addChild(this.text)
        this.view.addChild(this.cursor)

        this.buffer = ''
        this.cursorPos = 0
        this.selectionStart = null
        this.open_ = false
        this.cursorVisible = true
        this.blinkTimer = null
        this.onCommit = null
        this.onCancel = null
        this.input = null
        this.boundKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e)
        this.boundSync = (): void => this.syncFromInput()
    }

    get isOpen(): boolean {
        return this.open_
    }

    get value(): string {
        return this.buffer
    }

    /** Opens the editor with its top-center anchored at (x, y) (the same point the label itself is drawn from), prefilled with `initial`. */
    open(x: number, y: number, initial: string, onCommit: (value: string) => void, onCancel: () => void): void {
        if (this.open_) {
            this.commit()
        }
        this.buffer = initial
        this.cursorPos = initial.length
        this.selectionStart = null
        this.onCommit = onCommit
        this.onCancel = onCancel
        this.open_ = true
        this.cursorVisible = true
        this.view.position.set(x, y)
        this.view.visible = true
        this.createHiddenInput(initial)
        this.redraw()
        this.blinkTimer = setInterval(this.toggleCursor, CURSOR_BLINK_INTERVAL_MS)
    }

    /** Commits the current buffer (trimmed) and closes. Used both for Enter and for "click elsewhere" blur. */
    commit(): void {
        if (!this.open_) {
            return
        }
        const value = this.buffer.trim()
        const cb = this.onCommit
        this.close()
        cb?.(value)
    }

    cancel(): void {
        if (!this.open_) {
            return
        }
        const cb = this.onCancel
        this.close()
        cb?.()
    }

    private createHiddenInput(initial: string): void {
        const input = document.createElement('input')
        input.type = 'text'
        input.maxLength = MAX_NAME_LENGTH
        input.value = initial
        input.style.position = 'fixed'
        input.style.left = '-9999px'
        input.style.top = '-9999px'
        input.style.opacity = '0'
        input.style.pointerEvents = 'none'
        document.body.appendChild(input)
        input.addEventListener('keydown', this.boundKeyDown)
        input.addEventListener('input', this.boundSync)
        input.addEventListener('keyup', this.boundSync)
        this.input = input
        // open() runs inside a pointerdown handler on the canvas, which isn't a
        // focusable element itself. Focusing synchronously here still loses:
        // right after this handler returns, the browser's own default
        // mousedown handling blurs whatever is focused because the actual
        // click target (the canvas) can't take focus. Deferring to the next
        // task runs after that default blur, so the focus sticks.
        setTimeout((): void => {
            if (this.input !== input) {
                return
            }
            input.focus()
            input.setSelectionRange(initial.length, initial.length)
        }, 0)
    }

    private removeHiddenInput(): void {
        if (!this.input) {
            return
        }
        this.input.removeEventListener('keydown', this.boundKeyDown)
        this.input.removeEventListener('input', this.boundSync)
        this.input.removeEventListener('keyup', this.boundSync)
        this.input.remove()
        this.input = null
    }

    private close(): void {
        this.open_ = false
        this.view.visible = false
        this.onCommit = null
        this.onCancel = null
        this.removeHiddenInput()
        if (this.blinkTimer !== null) {
            clearInterval(this.blinkTimer)
            this.blinkTimer = null
        }
    }

    private toggleCursor: () => void = (): void => {
        this.cursorVisible = !this.cursorVisible
        this.redraw()
    }

    /** Mirrors the hidden input's value and caret/selection into the buffer used for Pixi rendering. */
    private syncFromInput(): void {
        if (!this.input) {
            return
        }
        this.buffer = this.input.value
        const start = this.input.selectionStart ?? this.buffer.length
        const end = this.input.selectionEnd ?? this.buffer.length
        this.cursorPos = end
        this.selectionStart = start !== end ? start : null
        this.cursorVisible = true
        this.redraw()
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter') {
            e.preventDefault()
            this.commit()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            this.cancel()
        }
    }

    private measureWidth(substring: string): number {
        this.measurer.text = substring
        return this.measurer.width
    }

    private redraw(): void {
        this.text.text = this.buffer.length > 0 ? this.buffer : ' '
        const textWidth = this.text.width
        const textHeight = this.text.height
        const width = Math.max(textWidth, 10) + PADDING_X * 2 + CURSOR_WIDTH
        const height = textHeight + PADDING_Y * 2

        this.bg.clear()
        this.bg.roundRect(-width / 2, 0, width, height, RADIUS)
        this.bg.fill({ color: BG_COLOR, alpha: BG_ALPHA })
        this.bg.roundRect(-width / 2, 0, width, height, RADIUS)
        this.bg.stroke({ color: BORDER_COLOR, width: 1.5, alpha: 0.9 })

        const textX = -width / 2 + PADDING_X
        this.text.position.set(textX, PADDING_Y)

        this.selectionHighlight.clear()
        this.cursor.clear()
        if (this.selectionStart !== null && this.selectionStart !== this.cursorPos) {
            const start = Math.min(this.selectionStart, this.cursorPos)
            const end = Math.max(this.selectionStart, this.cursorPos)
            const selectionX = textX + this.measureWidth(this.buffer.slice(0, start))
            const selectionWidth = this.measureWidth(this.buffer.slice(start, end))
            this.selectionHighlight.rect(selectionX, PADDING_Y, selectionWidth, textHeight)
            this.selectionHighlight.fill({ color: BORDER_COLOR, alpha: 0.4 })
        } else if (this.cursorVisible) {
            const cursorX = textX + this.measureWidth(this.buffer.slice(0, this.cursorPos))
            this.cursor.rect(cursorX, PADDING_Y, CURSOR_WIDTH, textHeight)
            this.cursor.fill({ color: TEXT_COLOR, alpha: 0.9 })
        }
    }
}
