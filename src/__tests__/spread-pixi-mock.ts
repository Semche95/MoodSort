type Handler = (payload: unknown) => void

/** Just enough of Pixi for the stack spread: containers that record drawing calls and replay listeners. */
export class MockContainer {
    label: string = ''
    x: number = 0
    y: number = 0
    width: number = 0
    height: number = 0
    eventMode: string = 'auto'
    cursor: string = 'default'
    visible: boolean = true
    alpha: number = 1
    tint: number = 0xffffff
    hitArea: unknown = null
    parent: MockContainer | null = null
    children: MockContainer[] = []
    calls: Array<{ method: string; args: unknown[] }> = []
    handlers: Record<string, Handler[]> = {}
    position: { set(x: number, y: number): void } = { set: (x: number, y: number): void => { this.x = x; this.y = y } }
    scale: { x: number; y: number; set(value: number): void } = {
        x: 1,
        y: 1,
        set: (value: number): void => { this.scale.x = value; this.scale.y = value },
    }
    addChild<T extends MockContainer>(child: T): T {
        child.parent?.children.splice(child.parent.children.indexOf(child), 1)
        this.children.push(child)
        child.parent = this
        return child
    }
    on(event: string, fn: Handler): this {
        (this.handlers[event] ??= []).push(fn)
        return this
    }
    off(event: string, fn: Handler): this {
        this.handlers[event] = (this.handlers[event] ?? []).filter((candidate: Handler): boolean => candidate !== fn)
        return this
    }
    emit(event: string, payload: unknown): void {
        for (const fn of this.handlers[event] ?? []) {
            fn(payload)
        }
    }
}

type Recorder = (this: MockContainer, ...args: unknown[]) => MockContainer

function recorder(method: string): Recorder {
    return function record(this: MockContainer, ...args: unknown[]): MockContainer {
        this.calls.push({ method, args })
        return this
    }
}

export class MockGraphics extends MockContainer {
    clear: Recorder = recorder('clear')
    rect: Recorder = recorder('rect')
    roundRect: Recorder = recorder('roundRect')
    circle: Recorder = recorder('circle')
    moveTo: Recorder = recorder('moveTo')
    lineTo: Recorder = recorder('lineTo')
    closePath: Recorder = recorder('closePath')
    fill: Recorder = recorder('fill')
    stroke: Recorder = recorder('stroke')
}

export class MockSprite extends MockContainer {
    texture: unknown
    constructor(texture: unknown) {
        super()
        this.texture = texture
    }
}

/** Measures 7px per character, so truncation and pill widths are predictable. */
export class MockText extends MockContainer {
    private value: string = ''
    style: Record<string, unknown>
    anchor: { set(x: number, y: number): void } = { set: (): void => {} }
    constructor(options: { text?: string; style?: Record<string, unknown> } = {}) {
        super()
        this.text = options.text ?? ''
        this.style = options.style ?? {}
    }
    get text(): string {
        return this.value
    }
    set text(value: string) {
        this.value = value
        this.width = value.length * 7
    }
}

export class MockRectangle {
    constructor(public x: number, public y: number, public width: number, public height: number) {}
}

export const spreadPixiMock = {
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Text: MockText,
    Rectangle: MockRectangle,
    Texture: { EMPTY: { width: 0, height: 0 } },
}
