import { Card } from '../../types/card.types'
import { Box } from '../../types/box.types'
import { Position } from '../../types/position.types'
import { StackPillLayout } from '../../types/stack-pill-layout.types'
import { computeBoundingBox } from './stack-geometry'
import {
    STACK_HIGHLIGHT_PADDING,
    STACK_FRAME_RADIUS,
    STACK_PILL_HEIGHT,
    STACK_PILL_PADDING,
    STACK_PILL_ICON_WIDTH,
    STACK_PILL_GRIP_WIDTH,
    STACK_PILL_NAME_PADDING,
} from './stack'

const PILL_ICONS_WIDTH = STACK_PILL_PADDING * 2 + STACK_PILL_GRIP_WIDTH + STACK_PILL_ICON_WIDTH

export function isPointInBox(point: Position, box: Box): boolean {
    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
}

export function computeStackFrame(box: Box): Box {
    return {
        x: box.x - STACK_HIGHLIGHT_PADDING,
        y: box.y - STACK_HIGHLIGHT_PADDING,
        width: box.width + STACK_HIGHLIGHT_PADDING * 2,
        height: box.height + STACK_HIGHLIGHT_PADDING * 2,
    }
}

/** Widest a pill may grow: the frame's straight top/bottom edge, between its rounded corners. */
export function computeStackPillMaxWidth(box: Box): number {
    return computeStackFrame(box).width - STACK_FRAME_RADIUS * 2
}

/** Room left for the name once the grip and rename icons are reserved, so the name never shifts when the pill is hovered. */
export function computeStackNameMaxWidth(box: Box): number {
    return Math.max(0, computeStackPillMaxWidth(box) - PILL_ICONS_WIDTH - STACK_PILL_NAME_PADDING * 2)
}

/** Lays out the top pill around a name already measured (and truncated) to `nameWidth`, or without a name when null. */
export function computeStackPillLayout(box: Box, nameWidth: number | null): StackPillLayout {
    const frame = computeStackFrame(box)
    const nameSlot = nameWidth === null ? 0 : nameWidth + STACK_PILL_NAME_PADDING * 2
    const width = PILL_ICONS_WIDTH + nameSlot
    const pill = {
        x: frame.x + (frame.width - width) / 2,
        y: frame.y - STACK_PILL_HEIGHT / 2,
        width,
        height: STACK_PILL_HEIGHT,
    }
    const grip = { x: pill.x + STACK_PILL_PADDING, y: pill.y, width: STACK_PILL_GRIP_WIDTH, height: STACK_PILL_HEIGHT }
    return {
        frame,
        pill,
        grip,
        name: nameWidth === null ? null : { x: grip.x + grip.width + STACK_PILL_NAME_PADDING, y: frame.y },
        pencil: {
            x: pill.x + width - STACK_PILL_PADDING - STACK_PILL_ICON_WIDTH,
            y: pill.y,
            width: STACK_PILL_ICON_WIDTH,
            height: STACK_PILL_HEIGHT,
        },
    }
}

// Returns null for stacks with fewer than 2 cards: compacting only makes sense on an actual stack.
export function computeCompactButtonBox(stack: Card[]): Box | null {
    if (stack.length < 2) {
        return null
    }
    const frame = computeStackFrame(computeBoundingBox(stack))
    const width = STACK_PILL_PADDING * 2 + STACK_PILL_ICON_WIDTH
    return {
        x: frame.x + (frame.width - width) / 2,
        y: frame.y + frame.height - STACK_PILL_HEIGHT / 2,
        width,
        height: STACK_PILL_HEIGHT,
    }
}

export function findStackByCompactButtonAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeCompactButtonBox(stack)
        if (box && isPointInBox(point, box)) {
            return stack
        }
    }
    return null
}
