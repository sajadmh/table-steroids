import type { SelectableItem, Selection, SelectionBounds } from "./types.js";
export interface SelectionStateSnapshot {
    selections: SelectionBounds[];
    activeSelection: SelectionBounds | null;
}
/**
 * Captures the current selection state in a row/column-index-based format.
 */
export declare function snapshotSelectionState(selections: Selection[], activeSelection: Selection | null, rows: SelectableItem[], columns: SelectableItem[]): SelectionStateSnapshot;
/**
 * Restores a saved selection snapshot against the current table shape.
 */
export declare function restoreSelectionState(snapshot: SelectionStateSnapshot, rows: SelectableItem[], columns: SelectableItem[]): {
    selections: Selection[];
    activeSelection: Selection | null;
};
