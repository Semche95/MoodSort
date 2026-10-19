/** Grid the spread lays a stack's cards on, in stage px: one window of `visibleRows` rows scrolled over `totalRows`. */
export interface StackSpreadLayout {
    cardWidth: number
    cardHeight: number
    columns: number
    visibleRows: number
    totalRows: number
    /** Top-left corner of the first visible cell */
    originX: number
    originY: number
}
