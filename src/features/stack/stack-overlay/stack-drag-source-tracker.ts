import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeStacks } from '../stack'
import { computeLabelAnchorPoint } from '../stack-naming'

/**
 * Tracks which stack a card being handle-dragged was pulled from, so the
 * pile it left behind (and its label) can keep rendering at its frozen
 * pre-drag spot for the whole drag, and remembers every resting stack so a
 * dragging card can be traced back to the pile it started in.
 */
export class StackDragSourceTracker {
    private restStacksMap: Map<Card, Card[]>
    private sourceCardsValue: Card[] | null
    private sourceGroupsValue: Card[][]
    private sourceLabelPointValue: Position | null

    constructor() {
        this.restStacksMap = new Map()
        this.sourceCardsValue = null
        this.sourceGroupsValue = []
        this.sourceLabelPointValue = null
    }

    get restStacks(): Map<Card, Card[]> {
        return this.restStacksMap
    }

    get sourceCards(): Card[] | null {
        return this.sourceCardsValue
    }

    get sourceGroups(): Card[][] {
        return this.sourceGroupsValue
    }

    get sourceLabelPoint(): Position | null {
        return this.sourceLabelPointValue
    }

    captureIfDragStarted(cards: Card[], draggingCard: Card | undefined): void {
        if (!draggingCard) {
            this.sourceCardsValue = null
            this.sourceGroupsValue = []
            this.sourceLabelPointValue = null
            for (const stack of computeStacks(cards)) {
                for (const card of stack) {
                    this.restStacksMap.set(card, stack)
                }
            }
        } else if (this.sourceCardsValue === null) {
            const source = this.restStacksMap.get(draggingCard)
            if (source) {
                this.sourceCardsValue = source
                // Captured once, at drag start: the name belongs to the pile, not to
                // whichever card happens to carry it, so its label stays put at the
                // pile's original spot for the whole drag instead of tracking the
                // card that's moving.
                this.sourceLabelPointValue = computeLabelAnchorPoint(source)
                const remaining = source.filter((card: Card): boolean => card !== draggingCard)
                this.sourceGroupsValue = computeStacks(remaining)
            }
        }
    }
}
