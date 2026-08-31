import { Container } from 'pixi.js'
import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { constrainPosition } from '../../shared/utils/geometry'

/** Padding (in px) added around the stack bounding box highlight */
export const STACK_HIGHLIGHT_PADDING: number = 20

/** Height (in px) of the stack drag handle bar */
export const STACK_HANDLE_HEIGHT: number = 22

/** Size (in px) of the square stack compact button, next to the drag handle. Deliberately matches STACK_HANDLE_HEIGHT so it never looks smaller than the handle it sits beside. */
export const STACK_COMPACT_BUTTON_SIZE: number = STACK_HANDLE_HEIGHT

/** Gap (in px) between the stack drag handle and the compact button */
export const STACK_COMPACT_BUTTON_GAP: number = 16

/** Size (in px) of the square stack "name" button, mirroring the compact button on the other side of the handle */
export const STACK_NAME_BUTTON_SIZE: number = STACK_HANDLE_HEIGHT

/** Gap (in px) between the stack drag handle and the name button */
export const STACK_NAME_BUTTON_GAP: number = 16

/** Small breathing gap (in px) between the handle's bottom edge and the name label drawn just below it, so the label never overlaps the handle's clickable area. */
export const STACK_LABEL_HANDLE_GAP: number = 4

/**
 * Minimum distance (in px) a stack's bounding box top must keep from the
 * canvas top edge, so its drag handle (which is drawn above the box) always
 * stays fully on-canvas and clickable.
 */
export const STACK_HANDLE_TOP_CLEARANCE: number = STACK_HIGHLIGHT_PADDING + STACK_HANDLE_HEIGHT / 2

/**
 * Clamps a candidate (x, y) to the canvas for a card-sized object, reserving
 * STACK_HANDLE_TOP_CLEARANCE at the top. Every place that positions a card
 * (drag, load, resize, shuffle, compact) needs this same clamp, so this
 * wraps constrainPosition to avoid repeating its card-specific arguments at
 * every call site.
 */
export function clampCardPosition(
    x: number,
    y: number,
    card: { width: number; height: number },
    appWidth: number,
    appHeight: number,
): Position {
    return constrainPosition(x, y, card.width, card.height, appWidth, appHeight, STACK_HANDLE_TOP_CLEARANCE)
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Generic axis-aligned bounding box overlap test, shared by every collision
 * check in this file (stack flood-fill, merge-target detection) so a new
 * kind of overlap check (e.g. a dragged card against a label's own render
 * area) can reuse it instead of duplicating the test.
 */
export function boxesOverlap(a: Box, b: Box): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    )
}

function cardsOverlap(a: Card, b: Card): boolean {
    return boxesOverlap(a, b)
}

export function findStack(card: Card, allCards: Card[]): Card[] {
    const stack: Card[] = []
    const visited = new Set<Card>()
    const queue = [card]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        stack.push(current)
        for (const other of allCards) {
            if (!visited.has(other) && cardsOverlap(current, other)) {
                queue.push(other)
            }
        }
    }
    return stack
}

export function computeBoundingBox(cards: Card[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const card of cards) {
        minX = Math.min(minX, card.x)
        minY = Math.min(minY, card.y)
        maxX = Math.max(maxX, card.x + card.width)
        maxY = Math.max(maxY, card.y + card.height)
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function computeStacks(cards: Card[]): Card[][] {
    const stacks: Card[][] = []
    const assigned = new Set<Card>()
    for (const card of cards) {
        if (assigned.has(card)) {
            continue
        }
        const stack = findStack(card, cards)
        stacks.push(stack)
        for (const c of stack) {
            assigned.add(c)
        }
    }
    return stacks
}

export function findStackAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeBoundingBox(stack)
        if (
            point.x >= box.x - STACK_HIGHLIGHT_PADDING &&
            point.x <= box.x + box.width + STACK_HIGHLIGHT_PADDING &&
            point.y >= box.y - STACK_HIGHLIGHT_PADDING - STACK_HANDLE_HEIGHT &&
            point.y <= box.y + box.height + STACK_HIGHLIGHT_PADDING
        ) {
            return stack
        }
    }
    return null
}

// Returns null for stacks with fewer than 2 cards: the compact button only makes sense on an actual stack.
export function computeCompactButtonBox(
    stack: Card[],
): { x: number; y: number; width: number; height: number } | null {
    if (stack.length < 2) {
        return null
    }
    const box = computeBoundingBox(stack)
    const pad = STACK_HIGHLIGHT_PADDING
    const bx = box.x - pad
    const by = box.y - pad
    const bw = box.width + pad * 2
    const handleWidth = Math.min(bw, 80)
    const hx = bx + (bw - handleWidth) / 2
    const hy = by - STACK_HANDLE_HEIGHT / 2

    return {
        x: hx + handleWidth + STACK_COMPACT_BUTTON_GAP,
        y: hy + (STACK_HANDLE_HEIGHT - STACK_COMPACT_BUTTON_SIZE) / 2,
        width: STACK_COMPACT_BUTTON_SIZE,
        height: STACK_COMPACT_BUTTON_SIZE,
    }
}

export function findStackByCompactButtonAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeCompactButtonBox(stack)
        if (!box) {
            continue
        }
        if (
            point.x >= box.x &&
            point.x <= box.x + box.width &&
            point.y >= box.y &&
            point.y <= box.y + box.height
        ) {
            return stack
        }
    }
    return null
}

/**
 * A dragged group moves as one rigid block, so it must be clamped as a
 * whole rather than per-card (otherwise cards would drift apart when the
 * clamp kicks in for some of them but not others). Returns the x/y offset
 * to add to every card in the group to keep its bounding box within the
 * canvas, reserving STACK_HANDLE_TOP_CLEARANCE at the top for the drag
 * handle drawn above it.
 */
export function computeGroupClampOffset(cards: Card[], appWidth: number, appHeight: number): Position {
    const box = computeBoundingBox(cards)
    let x = 0
    let y = 0
    if (box.x < 0) {
        x = -box.x
    } else if (box.x + box.width > appWidth) {
        x = appWidth - (box.x + box.width)
    }
    if (box.y < STACK_HANDLE_TOP_CLEARANCE) {
        y = STACK_HANDLE_TOP_CLEARANCE - box.y
    } else if (box.y + box.height > appHeight) {
        y = appHeight - (box.y + box.height)
    }
    return { x, y }
}

/**
 * A stack's identity (and thus its name) is carried by its "anchor": the
 * card at the lowest z-order (furthest back / bottom of the pile) at the
 * moment it was named. Composition can change freely around it — the anchor
 * is what stays put.
 */
export function getStackAnchor(stack: Card[], cardLayer: Container): Card {
    return stack.reduce((lowest: Card, card: Card): Card =>
        cardLayer.children.indexOf(card) < cardLayer.children.indexOf(lowest) ? card : lowest)
}

function sortedNamedCards(stack: Card[], cardLayer: Container, stackNames: Record<string, string>): Card[] {
    return stack
        .filter((card: Card): boolean => Boolean(stackNames[card.imageUrl]))
        .sort((a: Card, b: Card): number => cardLayer.children.indexOf(a) - cardLayer.children.indexOf(b))
}

/**
 * A stack's displayed label is the name(s) of whichever of its cards are
 * currently acting as an anchor, in z-order. A plain stack has none (empty
 * string); a stack formed by merging two previously-named stacks shows both,
 * concatenated with " + ".
 */
export function computeStackLabel(
    stack: Card[],
    cardLayer: Container,
    stackNames: Record<string, string>,
): string {
    return sortedNamedCards(stack, cardLayer, stackNames)
        .map((card: Card): string => stackNames[card.imageUrl])
        .join(' + ')
}

/**
 * The card whose stackNames entry should be edited when renaming this stack:
 * whichever card currently already carries the stack's name (there's at most
 * one, unless two named stacks just merged, in which case this is the one
 * shown first in the label), or a fresh lowest-z-order anchor if the stack
 * isn't named yet. This must not simply be getStackAnchor's live z-order
 * pick, since a card that was named while at the bottom of the pile can
 * later end up elsewhere in z-order (e.g. dragged back on top of its old
 * stack-mates) while still being the one actually holding the name.
 */
export function findNameAnchor(stack: Card[], cardLayer: Container, stackNames: Record<string, string>): Card {
    const [firstNamed] = sortedNamedCards(stack, cardLayer, stackNames)
    return firstNamed ?? getStackAnchor(stack, cardLayer)
}

/** Before/after values (by imageUrl) for each stackNames slot a split reassigned, for bundling into an undo/redo history entry. */
export interface NameReassignment {
    before: Record<string, string | null>
    after: Record<string, string | null>
}

/**
 * Among the groups a single split just produced, picks the one a name should
 * follow: the largest group, except a group left with only one card is never
 * eligible while another group has two or more (a solo card can't inherit a
 * name just by having been the anchor). If every resulting group is a
 * singleton, or several tie for largest among groups of 2+, the tie is
 * broken the same way a name is normally anchored: the group holding the
 * lowest z-order card.
 */
function pickWinningGroup(groups: Card[][], cardLayer: Container): Card[] {
    const eligible = groups.some((group: Card[]): boolean => group.length >= 2)
        ? groups.filter((group: Card[]): boolean => group.length >= 2)
        : groups
    const maxSize = Math.max(...eligible.map((group: Card[]): number => group.length))
    const largest = eligible.filter((group: Card[]): boolean => group.length === maxSize)
    return largest.reduce((best: Card[], group: Card[]): Card[] => {
        const bestAnchor = getStackAnchor(best, cardLayer)
        const anchor = getStackAnchor(group, cardLayer)
        return cardLayer.children.indexOf(anchor) < cardLayer.children.indexOf(bestAnchor) ? group : best
    })
}

/**
 * Whenever a stack with exactly one named card splits into multiple groups
 * (e.g. a card gets dragged off a named pile), the name must follow whichever
 * resulting group "wins" per pickWinningGroup, not simply stay wherever the
 * literal named card physically ends up. Mutates `stackNames` in place and
 * returns the before/after values of every slot it touched, so the caller
 * can bundle the reassignment into an undoable history entry.
 *
 * A stack that already carries two or more names (from an earlier merge of
 * two named stacks) is left alone: splitting it back apart already sends
 * each name back to its own card with no reassignment needed.
 */
export function resolveNameSplits(
    previousStacks: Card[][],
    newStacks: Card[][],
    cardLayer: Container,
    stackNames: Record<string, string>,
): NameReassignment {
    const before: Record<string, string | null> = {}
    const after: Record<string, string | null> = {}

    for (const previous of previousStacks) {
        const namedCards = previous.filter((card: Card): boolean => Boolean(stackNames[card.imageUrl]))
        if (namedCards.length !== 1) {
            continue
        }
        const [namedCard] = namedCards
        const resultGroups: Card[][] = []
        for (const group of newStacks) {
            if (!resultGroups.includes(group) && group.some((card: Card): boolean => previous.includes(card))) {
                resultGroups.push(group)
            }
        }
        if (resultGroups.length <= 1) {
            continue
        }
        const currentGroup = resultGroups.find((group: Card[]): boolean => group.includes(namedCard))
        if (!currentGroup) {
            continue
        }
        const winner = pickWinningGroup(resultGroups, cardLayer)
        if (winner === currentGroup) {
            continue
        }
        const name = stackNames[namedCard.imageUrl]
        const newAnchor = getStackAnchor(winner, cardLayer)
        delete stackNames[namedCard.imageUrl]
        stackNames[newAnchor.imageUrl] = name
        before[namedCard.imageUrl] = name
        after[namedCard.imageUrl] = null
        before[newAnchor.imageUrl] = null
        after[newAnchor.imageUrl] = name
    }

    return { before, after }
}

/**
 * Anchor point for the stack's name label: top-center, positioned just below
 * the drag handle's bottom edge (with a small clearance gap) so the label
 * never sits on top of the handle's clickable area and steals its clicks.
 * The text itself is top-anchored (not center-anchored) at this point, so it
 * only ever grows downward from here, possibly overlapping the top card's
 * artwork below it; that's an acceptable trade-off for legibility.
 */
export function computeLabelAnchorPoint(stack: Card[]): Position {
    const box = computeBoundingBox(stack)
    const pad = STACK_HIGHLIGHT_PADDING
    const cx = box.x + box.width / 2
    const cy = box.y - pad + STACK_HANDLE_HEIGHT / 2 + STACK_LABEL_HANDLE_GAP
    return { x: cx, y: cy }
}

// Sits symmetrically opposite the compact button, on the other side of the handle. Unlike
// the compact button, it applies to single-card "stacks" too: a lone anchor must stay renameable.
export function computeNameButtonBox(
    stack: Card[],
): { x: number; y: number; width: number; height: number } {
    const box = computeBoundingBox(stack)
    const pad = STACK_HIGHLIGHT_PADDING
    const bx = box.x - pad
    const by = box.y - pad
    const bw = box.width + pad * 2
    const handleWidth = Math.min(bw, 80)
    const hx = bx + (bw - handleWidth) / 2
    const hy = by - STACK_HANDLE_HEIGHT / 2

    return {
        x: hx - STACK_NAME_BUTTON_GAP - STACK_NAME_BUTTON_SIZE,
        y: hy + (STACK_HANDLE_HEIGHT - STACK_NAME_BUTTON_SIZE) / 2,
        width: STACK_NAME_BUTTON_SIZE,
        height: STACK_NAME_BUTTON_SIZE,
    }
}

export function findStackByNameButtonAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeNameButtonBox(stack)
        if (
            point.x >= box.x &&
            point.x <= box.x + box.width &&
            point.y >= box.y &&
            point.y <= box.y + box.height
        ) {
            return stack
        }
    }
    return null
}

export function findMergeTargets(
    draggedStack: Card[],
    stacks: Card[][],
    sourceStack: Card[] | null,
): Card[][] {
    const draggedBox = computeBoundingBox(draggedStack)
    const targets: Card[][] = []
    for (const stack of stacks) {
        if (stack === sourceStack) {
            continue
        }
        const box = computeBoundingBox(stack)
        if (boxesOverlap(draggedBox, box)) {
            targets.push(stack)
        }
    }
    return targets
}
