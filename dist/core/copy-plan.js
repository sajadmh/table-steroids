import { buildIndexMap, getSelectionBounds } from "./geometry.js";
/**
 * Attaches numeric bounds to a selection so copy logic can work with indexes.
 */
function getIndexedSelection(selection, rowIndexMap, columnIndexMap) {
    const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
    if (!bounds) {
        return null;
    }
    return {
        selection,
        ...bounds,
    };
}
/**
 * Converts a selection list into indexed selections and skips invalid entries.
 */
function getIndexedSelections(selections, rowIndexMap, columnIndexMap) {
    return selections
        .map((selection) => getIndexedSelection(selection, rowIndexMap, columnIndexMap))
        .filter((selection) => selection !== null);
}
function getCellText(value) {
    return value === null || value === undefined ? "" : String(value);
}
/**
 * Builds a single tab-separated row for one rectangular selection.
 */
function getRowText(row, selection, columns, getCellValue) {
    return getRowCells(row, selection, columns, getCellValue).join("\t");
}
/**
 * Reads the raw cell values for one row across a selection's column span.
 */
function getRowCells(row, selection, columns, getCellValue) {
    return columns
        .slice(selection.minColumn, selection.maxColumn + 1)
        .map((column) => getCellText(getCellValue(row.id, column.id)));
}
/**
 * Builds all copied text rows for one rectangular selection.
 */
function getSelectionRows(selection, rows, columns, getCellValue) {
    return rows
        .slice(selection.minRow, selection.maxRow + 1)
        .map((row) => getRowText(row, selection, columns, getCellValue));
}
/**
 * Chooses the simplest copy mode that preserves the current multi-selection shape.
 */
export function resolveCopySelection(selections, activeSelection, rows, columns) {
    if (!activeSelection) {
        return null;
    }
    const rowIndexMap = buildIndexMap(rows);
    const columnIndexMap = buildIndexMap(columns);
    const indexedSelections = getIndexedSelections(selections, rowIndexMap, columnIndexMap);
    const firstSelection = indexedSelections[0];
    if (indexedSelections.length <= 1) {
        return {
            mode: "single",
            selections: [firstSelection?.selection ?? activeSelection],
        };
    }
    const sameRowSpan = indexedSelections.every((selection) => selection.minRow === firstSelection.minRow && selection.maxRow === firstSelection.maxRow);
    if (sameRowSpan) {
        return {
            mode: "horizontal",
            selections: indexedSelections
                .sort((left, right) => left.minColumn - right.minColumn)
                .map((selection) => selection.selection),
        };
    }
    const sameColumnSpan = indexedSelections.every((selection) => selection.minColumn === firstSelection.minColumn && selection.maxColumn === firstSelection.maxColumn);
    if (sameColumnSpan) {
        return {
            mode: "vertical",
            selections: indexedSelections.sort((left, right) => left.minRow - right.minRow).map((selection) => selection.selection),
        };
    }
    return {
        mode: "single",
        selections: [activeSelection],
    };
}
/**
 * Converts a copy plan into tab/newline-delimited spreadsheet text.
 */
export function copySelectionToText(plan, rows, columns, getCellValue) {
    const rowIndexMap = buildIndexMap(rows);
    const columnIndexMap = buildIndexMap(columns);
    const indexedSelections = getIndexedSelections(plan.selections, rowIndexMap, columnIndexMap);
    const firstSelection = indexedSelections[0];
    if (indexedSelections.length === 0) {
        return "";
    }
    if (plan.mode === "single") {
        return getSelectionRows(firstSelection, rows, columns, getCellValue).join("\n");
    }
    if (plan.mode === "horizontal") {
        const rowRange = rows.slice(firstSelection.minRow, firstSelection.maxRow + 1);
        return rowRange
            .map((row) => indexedSelections.flatMap((selection) => getRowCells(row, selection, columns, getCellValue)).join("\t"))
            .join("\n");
    }
    return indexedSelections.flatMap((selection) => getSelectionRows(selection, rows, columns, getCellValue)).join("\n");
}
