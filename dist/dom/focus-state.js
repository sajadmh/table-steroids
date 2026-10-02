import { getSelectionBounds } from "../core/geometry.js";
/**
 * Checks whether a coordinate still falls inside resolved selection bounds.
 */
function isCoordinateWithinBounds(coordinate, bounds, rowIndexMap, columnIndexMap) {
    if (!coordinate || !bounds) {
        return false;
    }
    const rowIndex = rowIndexMap[coordinate.rowId];
    const columnIndex = columnIndexMap[coordinate.columnId];
    if (rowIndex === undefined || columnIndex === undefined) {
        return false;
    }
    return (rowIndex >= bounds.minRow &&
        rowIndex <= bounds.maxRow &&
        columnIndex >= bounds.minColumn &&
        columnIndex <= bounds.maxColumn);
}
/**
 * Restores the focused cell and anchor cell for the current active selection.
 */
export function resolveSelectionFocusState(activeSelection, previousSelectedCell, previousRangeAnchorCell, rowIndexMap, columnIndexMap) {
    if (!activeSelection) {
        return {
            selectedCell: null,
            rangeAnchorCell: null,
        };
    }
    const activeBounds = getSelectionBounds(activeSelection, rowIndexMap, columnIndexMap);
    const selectedCell = isCoordinateWithinBounds(previousSelectedCell, activeBounds, rowIndexMap, columnIndexMap)
        ? previousSelectedCell
        : activeSelection.end;
    const rangeAnchorCell = isCoordinateWithinBounds(previousRangeAnchorCell, activeBounds, rowIndexMap, columnIndexMap)
        ? previousRangeAnchorCell
        : selectedCell;
    return {
        selectedCell,
        rangeAnchorCell,
    };
}
