import { Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import { STACK_NAME_MAX_WIDTH } from '../stack'

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
const CURSOR_WIDTH = 2
const CURSOR_BLINK_INTERVAL_MS = 500
const CLEAR_BUTTON_SIZE = 16
const CLEAR_BUTTON_GAP = 8
const CLEAR_BUTTON_HIT_PADDING = 4

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
    private readonly textClip: Container
    private readonly clipMask: Graphics
    private readonly selectionHighlight: Graphics
    private readonly text: Text
    private readonly cursor: Graphics
    private readonly clearButton: Graphics
    private readonly measurer: Text
    private buffer: string
    private cursorPos: number
    private selectionStart: number | null
    private scrollX: number
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
        // 'passive' (not 'none'): the box itself stays inert, but it lets clearButton, its one
        // interactive child, still receive its own pointer events.
        this.view.eventMode = 'passive'

        this.bg = new Graphics()
        this.bg.label = 'stack-name-editor-bg'

        // Clips text/selection/cursor to the box once a name grows past STACK_NAME_MAX_WIDTH,
        // so the box itself never grows past the stack's own frame: the visible text scrolls
        // to keep the caret in view instead, exactly like a native input does when it overflows.
        this.textClip = new Container()
        this.textClip.label = 'stack-name-editor-text-clip'
        this.clipMask = new Graphics()
        this.clipMask.label = 'stack-name-editor-clip-mask'
        this.textClip.addChild(this.clipMask)
        this.textClip.mask = this.clipMask

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

        // Sits outside textClip, right of the box, so it's never scrolled/clipped away and
        // stays clickable regardless of how long the name being edited is.
        this.clearButton = new Graphics()
        this.clearButton.label = 'stack-name-editor-clear'
        this.clearButton.cursor = 'pointer'
        this.clearButton.on('pointerdown', this.handleClearClick)

        // Off-view, never added to `view`: used only to measure the pixel width of a
        // substring (e.g. "up to the cursor"), so the cursor/selection can be
        // positioned without disturbing what's actually drawn as `this.text`.
        this.measurer = new Text({
            text: '',
            style: { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, fill: TEXT_COLOR },
        })

        this.textClip.addChild(this.selectionHighlight)
        this.textClip.addChild(this.text)
        this.textClip.addChild(this.cursor)

        this.view.addChild(this.bg)
        this.view.addChild(this.textClip)
        this.view.addChild(this.clearButton)

        this.buffer = ''
        this.cursorPos = 0
        this.selectionStart = null
        this.scrollX = 0
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
        this.scrollX = 0
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
        // No maxLength: a fused "Nom1 + Nom2" name can already be prefilled past any fixed
        // cap, and the native attribute then blocks all further typing (even a delete-then-
        // retype of one character) until the value drops back under it. The stack label is
        // already kept short on screen by truncateLabel's pixel-width truncation, so nothing
        // needs to cap the stored name itself.
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
        this.focusInputDeferred(input, initial.length)
    }

    /**
     * Focuses `input` and places its caret at `caretPos` on the next tick rather than right
     * away. Both call sites run inside a pointerdown handler on the canvas, which isn't a
     * focusable element itself: focusing synchronously still loses, because right after the
     * handler returns, the browser's own default mousedown handling blurs whatever is focused.
     * Deferring to the next task runs after that default blur, so the focus sticks. The guard
     * covers the editor having moved on to a different input (closed, or reopened elsewhere) by
     * the time this fires.
     */
    private focusInputDeferred(input: HTMLInputElement, caretPos: number): void {
        setTimeout((): void => {
            if (this.input !== input) {
                return
            }
            input.focus()
            input.setSelectionRange(caretPos, caretPos)
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

    /** Empties the field in one click, without committing/closing the editor. */
    private handleClearClick: (e: FederatedPointerEvent) => void = (e: FederatedPointerEvent): void => {
        // Stops this from also reaching the stage's own pointerdown handler, which commits and
        // closes the editor on any click outside of it - exactly like the name/compact buttons do.
        e.stopPropagation()
        const input = this.input
        if (!input || this.buffer.length === 0) {
            return
        }
        input.value = ''
        this.syncFromInput()
        this.focusInputDeferred(input, 0)
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
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Holding the key auto-repeats keydown but fires neither `input` nor `keyup` until
            // release, so without this the Pixi caret stayed frozen for the whole hold. The
            // browser applies its own default caret move after dispatch, not before, so the
            // sync is deferred to the next tick to read the input's selection once it's moved.
            setTimeout(this.boundSync, 0)
        }
    }

    private measureWidth(substring: string): number {
        this.measurer.text = substring
        return this.measurer.width
    }

    private redraw(): void {
        this.text.text = this.buffer.length > 0 ? this.buffer : ' '
        const fullTextWidth = this.text.width
        const textHeight = this.text.height
        const maxInnerWidth = STACK_NAME_MAX_WIDTH - PADDING_X * 2 - CURSOR_WIDTH
        const innerWidth = Math.min(Math.max(fullTextWidth, 10), maxInnerWidth)
        const width = innerWidth + PADDING_X * 2 + CURSOR_WIDTH
        const height = textHeight + PADDING_Y * 2

        this.bg.clear()
        this.bg.roundRect(-width / 2, 0, width, height, RADIUS)
        this.bg.fill({ color: BG_COLOR, alpha: BG_ALPHA })
        this.bg.roundRect(-width / 2, 0, width, height, RADIUS)
        this.bg.stroke({ color: BORDER_COLOR, width: 1.5, alpha: 0.9 })

        const textX = -width / 2 + PADDING_X
        // Clips to innerWidth + CURSOR_WIDTH, not just innerWidth: the caret drawn right after
        // the last character needs that same trailing slot the box itself reserves (width above
        // already adds CURSOR_WIDTH), or a caret sitting exactly at the text's end is clipped away entirely.
        this.clipMask.clear()
        this.clipMask.rect(textX, 0, innerWidth + CURSOR_WIDTH, height)
        this.clipMask.fill({ color: 0xffffff })

        // Keeps the caret inside the visible window, like a native input scrolls its content
        // once the text no longer fits, and never scrolls past either end of the text.
        const cursorOffset = this.measureWidth(this.buffer.slice(0, this.cursorPos))
        const maxScroll = Math.max(0, fullTextWidth - innerWidth)
        this.scrollX = Math.min(Math.max(this.scrollX, cursorOffset - innerWidth), cursorOffset)
        this.scrollX = Math.min(Math.max(this.scrollX, 0), maxScroll)

        const drawX = textX - this.scrollX
        this.text.position.set(drawX, PADDING_Y)

        this.selectionHighlight.clear()
        this.cursor.clear()
        if (this.selectionStart !== null && this.selectionStart !== this.cursorPos) {
            const start = Math.min(this.selectionStart, this.cursorPos)
            const end = Math.max(this.selectionStart, this.cursorPos)
            const selectionX = drawX + this.measureWidth(this.buffer.slice(0, start))
            const selectionWidth = this.measureWidth(this.buffer.slice(start, end))
            this.selectionHighlight.rect(selectionX, PADDING_Y, selectionWidth, textHeight)
            this.selectionHighlight.fill({ color: BORDER_COLOR, alpha: 0.4 })
        } else if (this.cursorVisible) {
            const cursorX = drawX + cursorOffset
            this.cursor.rect(cursorX, PADDING_Y, CURSOR_WIDTH, textHeight)
            this.cursor.fill({ color: TEXT_COLOR, alpha: 0.9 })
        }

        this.redrawClearButton(width, height)
    }

    /** Small "x" sitting just right of the box, only while there's something to clear. */
    private redrawClearButton(width: number, height: number): void {
        this.clearButton.clear()
        if (this.buffer.length === 0) {
            this.clearButton.eventMode = 'none'
            return
        }
        this.clearButton.eventMode = 'static'

        const cx = width / 2 + CLEAR_BUTTON_GAP + CLEAR_BUTTON_SIZE / 2
        const cy = height / 2
        const half = CLEAR_BUTTON_SIZE / 2
        const inset = CLEAR_BUTTON_SIZE * 0.26
        // A plain IHitArea object rather than a pixi.js Rectangle: several test files mock the
        // whole 'pixi.js' module with a handful of classes and don't export Rectangle.
        const hitHalf = half + CLEAR_BUTTON_HIT_PADDING
        this.clearButton.hitArea = {
            contains: (x: number, y: number): boolean =>
                x >= cx - hitHalf && x <= cx + hitHalf && y >= cy - hitHalf && y <= cy + hitHalf,
        }

        // A dark chip behind the "x" (same colors as the compact/name buttons), instead of a
        // bare stroke: floating directly on the canvas's own mid-gray background, a plain white
        // line at this size read as invisible rather than just low-contrast.
        this.clearButton.roundRect(cx - half, cy - half, CLEAR_BUTTON_SIZE, CLEAR_BUTTON_SIZE, 4)
        this.clearButton.fill({ color: 0x444444, alpha: 0.85 })

        this.clearButton.moveTo(cx - half + inset, cy - half + inset)
        this.clearButton.lineTo(cx + half - inset, cy + half - inset)
        this.clearButton.stroke({ color: 0xdddddd, width: 2, alpha: 0.95, cap: 'round' })
        this.clearButton.moveTo(cx + half - inset, cy - half + inset)
        this.clearButton.lineTo(cx - half + inset, cy + half - inset)
        this.clearButton.stroke({ color: 0xdddddd, width: 2, alpha: 0.95, cap: 'round' })
    }
}
