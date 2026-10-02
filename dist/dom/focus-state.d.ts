import type { CellCoordinates, Selection } from "../core/types.js";
/**
 * Restores the focused cell and anchor cell for the current active selection.
 */
export declare function resolveSelectionFocusState(activeSelection: Selection | null, previousSelectedCell: CellCoordinates | null, previousRangeAnchorCell: CellCoordinates | null, rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): {
    selectedCell: CellCoordinates | null;
    rangeAnchorCell: CellCoordinates | null;
};
