import { describe, expect, it, vi } from 'vitest'
import { StackNameEditor } from '../features/stack/stack-overlay/stack-name-editor'
import { STACK_NAME_MAX_WIDTH } from '../features/stack/stack'

const { pixi } = vi.hoisted(() => {
    class Container {
        label: string = ''
        x: number = 0
        y: number = 0
        width: number = 40
        height: number = 16
        visible: boolean = true
        eventMode: string = 'auto'
        cursor: string = 'default'
        hitArea: unknown = null
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
        on(): this {
            return this
        }
    }

    class Graphics extends Container {
        calls: Array<{ method: string; args: unknown[] }> = []
        clear(): this { this.calls.push({ method: 'clear', args: [] }); return this }
        roundRect(...args: unknown[]): this { this.calls.push({ method: 'roundRect', args }); return this }
        rect(...args: unknown[]): this { this.calls.push({ method: 'rect', args }); return this }
        fill(...args: unknown[]): this { this.calls.push({ method: 'fill', args }); return this }
        stroke(...args: unknown[]): this { this.calls.push({ method: 'stroke', args }); return this }
        moveTo(...args: unknown[]): this { this.calls.push({ method: 'moveTo', args }); return this }
        lineTo(...args: unknown[]): this { this.calls.push({ method: 'lineTo', args }); return this }
    }

    class Text extends Container {
        private _text: string
        constructor(options: { text?: string } = {}) {
            super()
            this._text = options.text ?? ''
            this.width = this._text.length * 10
        }
        get text(): string { return this._text }
        set text(value: string) {
            this._text = value
            this.width = value.length * 10
        }
    }

    return { pixi: { Container, Graphics, Text } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

/**
 * The editor now delegates all text editing to a real (invisible, off-screen)
 * `<input>` element so the browser's own typing, caret/selection and paste/IME
 * behavior drive it. jsdom doesn't simulate that native editing behavior, so
 * these helpers reproduce it by hand against `editor['input']`, exactly as a
 * real browser would before dispatching the same events our code listens for.
 */
function getInput(editor: StackNameEditor): HTMLInputElement | null {
    return editor['input'] as HTMLInputElement | null
}

function type(editor: StackNameEditor, text: string): void {
    const input = getInput(editor)
    if (!input) { return }
    for (const ch of text) {
        const start = input.selectionStart ?? input.value.length
        const end = input.selectionEnd ?? input.value.length
        const next = input.value.slice(0, start) + ch + input.value.slice(end)
        input.value = next
        input.setSelectionRange(start + 1, start + 1)
        input.dispatchEvent(new Event('input', { bubbles: true }))
    }
}

function pressBackspace(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? input.value.length
    if (start !== end) {
        input.value = input.value.slice(0, start) + input.value.slice(end)
        input.setSelectionRange(start, start)
    } else if (start > 0) {
        input.value = input.value.slice(0, start - 1) + input.value.slice(start)
        input.setSelectionRange(start - 1, start - 1)
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

function pressArrowLeft(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const pos = start !== end ? start : Math.max(0, start - 1)
    input.setSelectionRange(pos, pos)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }))
}

function pressArrowRight(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const pos = start !== end ? end : Math.min(input.value.length, end + 1)
    input.setSelectionRange(pos, pos)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
}

function pressHome(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    input.setSelectionRange(0, 0)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Home', bubbles: true }))
}

function pressEnd(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    input.setSelectionRange(input.value.length, input.value.length)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }))
}

function selectAll(editor: StackNameEditor): void {
    const input = getInput(editor)
    if (!input) { return }
    input.setSelectionRange(0, input.value.length)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', ctrlKey: true, bubbles: true }))
}

function pressEnter(editor: StackNameEditor): void {
    getInput(editor)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}

function pressEscape(editor: StackNameEditor): void {
    getInput(editor)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

describe('StackNameEditor', () => {
    it('is closed until open() is called', () => {
        const editor = new StackNameEditor()

        expect(editor.isOpen).toBe(false)
        expect(editor.view.visible).toBe(false)
        expect(getInput(editor)).toBeNull()
    })

    it('opens prefilled with the initial value, positioned at (x, y)', () => {
        const editor = new StackNameEditor()

        editor.open(10, 20, 'Joie', vi.fn(), vi.fn())

        expect(editor.isOpen).toBe(true)
        expect(editor.view.visible).toBe(true)
        expect(editor.value).toBe('Joie')
        expect(editor.view.x).toBe(10)
        expect(editor.view.y).toBe(20)
        expect(getInput(editor)?.value).toBe('Joie')
    })

    it('creates a hidden, off-screen input so no visible DOM element is added, and removes it on close', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())

        const input = getInput(editor)
        expect(input).not.toBeNull()
        expect(input?.style.opacity).toBe('0')
        expect(document.body.contains(input)).toBe(true)

        editor.commit()

        expect(getInput(editor)).toBeNull()
        expect(document.body.contains(input)).toBe(false)
    })

    it('appends typed characters to the buffer', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())

        type(editor, 'Joie')

        expect(editor.value).toBe('Joie')
    })

    it('allows editing a name that is already longer than a single-name cap (e.g. a fused "A + B")', () => {
        const fused = `${'a'.repeat(30)} + ${'b'.repeat(30)}`
        const editor = new StackNameEditor()
        editor.open(0, 0, fused, vi.fn(), vi.fn())

        pressBackspace(editor)
        type(editor, 'c')

        expect(editor.value).toBe(`${'a'.repeat(30)} + ${'b'.repeat(29)}c`)
    })

    it('empties the field when the clear button is clicked, without committing or closing the editor, and keeps it focused so typing still works right after', async () => {
        const onCommit = vi.fn()
        const editor = new StackNameEditor()
        editor.open(0, 0, 'Joie', onCommit, vi.fn())
        await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 0) })
        const input = getInput(editor)

        const clearButton = editor['clearButton'] as { eventMode: string }
        expect(clearButton.eventMode).toBe('static')
        const stopPropagation = vi.fn()
        ;(editor['handleClearClick'] as (e: { stopPropagation: () => void }) => void)({ stopPropagation })

        expect(stopPropagation).toHaveBeenCalled()
        expect(editor.value).toBe('')
        expect(editor.isOpen).toBe(true)
        expect(onCommit).not.toHaveBeenCalled()

        // Simulates the browser's own default pointerdown handling blurring the hidden input
        // right as this handler returns, between now and the deferred re-focus below.
        input?.blur()
        await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 0) })

        expect(document.activeElement).toBe(input)
        type(editor, 'X')
        expect(editor.value).toBe('X')
    })

    it('has nothing to clear (and nothing to click) once the field is already empty', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())

        const clearButton = editor['clearButton'] as { eventMode: string }
        expect(clearButton.eventMode).toBe('none')
    })

    it('caps the box width at STACK_NAME_MAX_WIDTH instead of growing past the stack\'s frame', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())

        type(editor, 'a'.repeat(50))

        const bg = editor['bg'] as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const lastRoundRect = bg.calls.filter((call: { method: string }): boolean => call.method === 'roundRect').pop()
        expect(lastRoundRect?.args[2]).toBe(STACK_NAME_MAX_WIDTH)
    })

    it('keeps the caret in sync while an arrow key is held (key-repeat), not just once it is released', async () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, 'Joie', vi.fn(), vi.fn())
        // Lets open()'s own deferred focus/selection settle first, exactly as it would have
        // long before a real user starts holding a key, so it doesn't race the assertion below.
        await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 0) })
        const input = getInput(editor)

        // Simulates the browser's own default action moving the native caret as part of this
        // keydown, which jsdom doesn't do for us; the production code must pick it up without
        // waiting for a `keyup` that a held-down key doesn't fire until release.
        input?.setSelectionRange(3, 3)
        input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', repeat: true, bubbles: true }))
        await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 0) })

        type(editor, 'X')

        expect(editor.value).toBe('JoiXe')
    })

    it('removes the last character on Backspace', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, 'Joie', vi.fn(), vi.fn())

        pressBackspace(editor)

        expect(editor.value).toBe('Joi')
    })

    it('inserts a typed character at the cursor position after moving it left with ArrowLeft, not just at the end', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        pressArrowLeft(editor)
        pressArrowLeft(editor)
        type(editor, 'X')

        expect(editor.value).toBe('JoXie')
    })

    it('moves the cursor back to the end with ArrowRight after moving left, so typing appends again', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        pressArrowLeft(editor)
        pressArrowLeft(editor)
        pressArrowRight(editor)
        pressArrowRight(editor)
        type(editor, 'X')

        expect(editor.value).toBe('JoieX')
    })

    it('jumps the cursor to the start with Home and to the end with End', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        pressHome(editor)
        type(editor, 'X')
        expect(editor.value).toBe('XJoie')

        pressEnd(editor)
        type(editor, 'Y')
        expect(editor.value).toBe('XJoieY')
    })

    it('clears the selection when Home or End is pressed while text is selected', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        selectAll(editor)
        pressHome(editor)
        type(editor, 'X')

        expect(editor.value).toBe('XJoie')
    })

    it('does not move the cursor past the start or end of the buffer', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Jo')

        // Cursor is clamped at index 0: Backspace there is a no-op, nothing before it to delete.
        for (let i = 0; i < 5; i++) {
            pressArrowLeft(editor)
        }
        pressBackspace(editor)
        expect(editor.value).toBe('Jo')

        // Cursor is clamped at the end: typing appends, exactly like never having moved it.
        for (let i = 0; i < 5; i++) {
            pressArrowRight(editor)
        }
        type(editor, '!')
        expect(editor.value).toBe('Jo!')
    })

    it('selects the whole buffer on Ctrl+A so the next typed character replaces it entirely', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        selectAll(editor)
        type(editor, 'X')

        expect(editor.value).toBe('X')
    })

    it('selects the whole buffer on Cmd+A (metaKey) too, for macOS', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        const input = getInput(editor)
        input?.setSelectionRange(0, input.value.length)
        input?.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', metaKey: true, bubbles: true }))
        type(editor, 'X')

        expect(editor.value).toBe('X')
    })

    it('clears the whole buffer on Backspace when everything is selected via Ctrl+A', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        type(editor, 'Joie')

        selectAll(editor)
        pressBackspace(editor)

        expect(editor.value).toBe('')
    })

    it('accepts a native paste through the hidden input, exactly like a typed character', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())

        const input = getInput(editor)
        // A real paste event mutates `.value` directly, then fires `input`, same
        // as the browser does once the clipboard write completes.
        input!.value = 'Colère'
        input!.setSelectionRange(6, 6)
        input?.dispatchEvent(new Event('input', { bubbles: true }))

        expect(editor.value).toBe('Colère')
    })

    it('commits the trimmed value and closes on Enter', () => {
        const onCommit = vi.fn()
        const editor = new StackNameEditor()
        editor.open(0, 0, '', onCommit, vi.fn())

        type(editor, '  Joie  ')
        pressEnter(editor)

        expect(onCommit).toHaveBeenCalledWith('Joie')
        expect(editor.isOpen).toBe(false)
        expect(editor.view.visible).toBe(false)
    })

    it('cancels without calling onCommit on Escape', () => {
        const onCommit = vi.fn()
        const onCancel = vi.fn()
        const editor = new StackNameEditor()
        editor.open(0, 0, 'Joie', onCommit, onCancel)

        pressEscape(editor)

        expect(onCommit).not.toHaveBeenCalled()
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(editor.isOpen).toBe(false)
    })

    it('commit() can be called programmatically to simulate blur (click elsewhere)', () => {
        const onCommit = vi.fn()
        const editor = new StackNameEditor()
        editor.open(0, 0, '', onCommit, vi.fn())

        type(editor, 'Joie')
        editor.commit()

        expect(onCommit).toHaveBeenCalledWith('Joie')
        expect(editor.isOpen).toBe(false)
    })

    it('commit() is a no-op when the editor is already closed', () => {
        const onCommit = vi.fn()
        const editor = new StackNameEditor()

        editor.commit()

        expect(onCommit).not.toHaveBeenCalled()
    })

    it('stops listening for keystrokes once closed', () => {
        const editor = new StackNameEditor()
        editor.open(0, 0, '', vi.fn(), vi.fn())
        editor.commit()

        type(editor, 'Joie')

        expect(editor.value).toBe('')
    })

    it('opening while already open commits the previous edit first', () => {
        const firstCommit = vi.fn()
        const editor = new StackNameEditor()
        editor.open(0, 0, '', firstCommit, vi.fn())
        type(editor, 'Joie')

        editor.open(5, 5, '', vi.fn(), vi.fn())

        expect(firstCommit).toHaveBeenCalledWith('Joie')
        expect(editor.value).toBe('')
    })
})
