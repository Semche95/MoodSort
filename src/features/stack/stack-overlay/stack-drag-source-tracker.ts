import { Card } from '../../../types/card.types'
import { computeStacks } from '../stack'

/**
 * Tracks which stack a card being dragged was pulled from, so the pile it
 * left behind keeps its frame and name for the whole drag, and remembers
 * every resting stack so a dragging card can be traced back to the pile it
 * started in.
 */
export class StackDragSourceTracker {
    private restStacksMap: Map<Card, Card[]>
    private sourceCardsValue: Card[] | null
    private sourceGroupsValue: Card[][]

    constructor() {
        this.restStacksMap = new Map()
        this.sourceCardsValue = null
        this.sourceGroupsValue = []
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

    captureIfDragStarted(cards: Card[], draggingCard: Card | undefined): void {
        if (!draggingCard) {
            this.sourceCardsValue = null
            this.sourceGroupsValue = []
                for (const stack of computeStacks(cards)) {
                for (const card of stack) {
                    this.restStacksMap.set(card, stack)
                }
            }
        } else if (this.sourceCardsValue === null) {
            const source = this.restStacksMap.get(draggingCard)
            if (source) {
                this.sourceCardsValue = source
                const remaining = source.filter((card: Card): boolean => card !== draggingCard)
                this.sourceGroupsValue = computeStacks(remaining)
            }
        }
    }
}
