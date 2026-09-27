import { Container } from 'pixi.js'
import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { NameReassignment } from '../../types/name-reassignment.types'
import { computeBoundingBox } from './stack-geometry'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT, STACK_LABEL_HANDLE_GAP } from './stack'

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

/**
 * Whenever a stack ends up with two or more named cards (two named piles
 * were merged by dragging one onto the other), their names are fused into a
 * single stackNames entry - the same " + "-joined string computeStackLabel
 * already displays - kept on the lowest z-order named card. Without this,
 * the label would show both names concatenated while the rename button,
 * which only ever edits one card's entry, could only ever reach the first.
 */
export function resolveNameMerges(
    stacks: Card[][],
    cardLayer: Container,
    stackNames: Record<string, string>,
): NameReassignment {
    const before: Record<string, string | null> = {}
    const after: Record<string, string | null> = {}
    for (const group of stacks) {
        const namedCards = sortedNamedCards(group, cardLayer, stackNames)
        if (namedCards.length < 2) {
            continue
        }
        const mergedName = namedCards.map((card: Card): string => stackNames[card.imageUrl]).join(' + ')
        const [anchor] = namedCards
        for (const card of namedCards) {
            before[card.imageUrl] = stackNames[card.imageUrl]
        }
        for (const card of namedCards) {
            if (card !== anchor) {
                delete stackNames[card.imageUrl]
                after[card.imageUrl] = null
            }
        }
        stackNames[anchor.imageUrl] = mergedName
        after[anchor.imageUrl] = mergedName
    }
    return { before, after }
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
        // Prefer an unnamed member of the winning group: if that group already has its own
        // named anchor (it just absorbed a card from another named stack in the same drag),
        // writing there would clobber that name instead of leaving the two to be fused by
        // resolveNameMerges right after. Only degenerate groups (every card already named,
        // which shouldn't happen given resolveNameMerges keeps groups to at most one name)
        // fall back to the plain anchor.
        const newAnchor = [...winner]
            .sort((x: Card, y: Card): number => cardLayer.children.indexOf(x) - cardLayer.children.indexOf(y))
            .find((card: Card): boolean => !stackNames[card.imageUrl]) ?? getStackAnchor(winner, cardLayer)
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
