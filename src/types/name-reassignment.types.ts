/** Before/after values (by imageUrl) for each stackNames slot a split or merge touched, for bundling into an undo/redo history entry. */
export interface NameReassignment {
    before: Record<string, string | null>
    after: Record<string, string | null>
}
