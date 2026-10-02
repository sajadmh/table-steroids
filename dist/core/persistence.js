import { boundsToSelection, buildIndexMap, getSelectionBounds, normalizeSelections, resolveActiveSelection } from "./geometry.js";
/**
 * Converts current selections into serializable numeric bounds.
 */
function toSnapshotBounds(selections, rowIndexMap, columnIndexMap) {
    return selections
        .map((selection) => getSelectionBounds(selection, rowIndexMap, columnIndexMap))
        .filter((bounds) => bounds !== null);
}
/**
 * Clamps one index so it stays within the available range.
 */
function clampIndex(index, maxIndex) {
    return Math.min(Math.max(index, 0), maxIndex);
}
/**
 * Clamps rectangular bounds so they fit inside the current table size.
 */
function clampBounds(bounds, rowCount, columnCount) {
    if (rowCount === 0 || columnCount === 0) {
        return null;
    }
    const maxRowIndex = rowCount - 1;
    const maxColumnIndex = columnCount - 1;
    const minRow = clampIndex(bounds.minRow, maxRowIndex);
    const maxRow = clampIndex(bounds.maxRow, maxRowIndex);
    const minColumn = clampIndex(bounds.minColumn, maxColumnIndex);
    const maxColumn = clampIndex(bounds.maxColumn, maxColumnIndex);
    return {
        minRow: Math.min(minRow, maxRow),
        maxRow: Math.max(minRow, maxRow),
        minColumn: Math.min(minColumn, maxColumn),
        maxColumn: Math.max(minColumn, maxColumn),
    };
}
/**
 * Captures the current selection state in a row/column-index-based format.
 */
export function snapshotSelectionState(selections, activeSelection, rows, columns) {
    const rowIndexMap = buildIndexMap(rows);
    const columnIndexMap = buildIndexMap(columns);
    return {
        selections: toSnapshotBounds(selections, rowIndexMap, columnIndexMap),
        activeSelection: activeSelection ? getSelectionBounds(activeSelection, rowIndexMap, columnIndexMap) : null,
    };
}
/**
 * Restores a saved selection snapshot against the current table shape.
 */
export function restoreSelectionState(snapshot, rows, columns) {
    const rowCount = rows.length;
    const columnCount = columns.length;
    const rowIndexMap = buildIndexMap(rows);
    const columnIndexMap = buildIndexMap(columns);
    const restoredSelections = snapshot.selections
        .map((bounds) => clampBounds(bounds, rowCount, columnCount))
        .filter((bounds) => bounds !== null)
        .map((bounds) => boundsToSelection(bounds, rows, columns))
        .filter((selection) => selection !== null);
    const normalizedSelections = normalizeSelections(restoredSelections, rows, columns, rowIndexMap, columnIndexMap);
    const clampedActiveBounds = snapshot.activeSelection
        ? clampBounds(snapshot.activeSelection, rowCount, columnCount)
        : null;
    const restoredActiveSelection = clampedActiveBounds ? boundsToSelection(clampedActiveBounds, rows, columns) : null;
    return {
        selections: normalizedSelections,
        activeSelection: resolveActiveSelection(normalizedSelections, restoredActiveSelection, rowIndexMap, columnIndexMap),
    };
}
