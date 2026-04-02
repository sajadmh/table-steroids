(()=>{const __factories={"core/geometry.js":function(exports,__require){/**
 * Converts valid selections into numeric bounds and drops any stale ones.
 */
function toSelectionBoundsList(selections, rowIndexMap, columnIndexMap) {
    return selections
        .map((selection) => getSelectionBounds(selection, rowIndexMap, columnIndexMap))
        .filter((bounds) => bounds !== null);
}
/**
 * Checks whether one rectangular bounds fully contains another.
 */
function containsBounds(container, candidate) {
    return (candidate.minRow >= container.minRow &&
        candidate.maxRow <= container.maxRow &&
        candidate.minColumn >= container.minColumn &&
        candidate.maxColumn <= container.maxColumn);
}
/**
 * Checks whether a single cell index falls inside rectangular bounds.
 */
function containsCell(bounds, rowIndex, columnIndex) {
    return (rowIndex >= bounds.minRow &&
        rowIndex <= bounds.maxRow &&
        columnIndex >= bounds.minColumn &&
        columnIndex <= bounds.maxColumn);
}
/**
 * Builds a quick lookup from item id to its current index.
 */
function buildIndexMap(items) {
    const indexMap = {};
    items.forEach((item, index) => {
        indexMap[item.id] = index;
    });
    return indexMap;
}
/**
 * Converts a selection from ids into numeric rectangular bounds.
 */
function getSelectionBounds(selection, rowIndexMap, columnIndexMap) {
    const startRowIndex = rowIndexMap[selection.start.rowId];
    const endRowIndex = rowIndexMap[selection.end.rowId];
    const startColumnIndex = columnIndexMap[selection.start.columnId];
    const endColumnIndex = columnIndexMap[selection.end.columnId];
    if (startRowIndex === undefined ||
        endRowIndex === undefined ||
        startColumnIndex === undefined ||
        endColumnIndex === undefined) {
        return null;
    }
    return {
        minRow: Math.min(startRowIndex, endRowIndex),
        maxRow: Math.max(startRowIndex, endRowIndex),
        minColumn: Math.min(startColumnIndex, endColumnIndex),
        maxColumn: Math.max(startColumnIndex, endColumnIndex),
    };
}
/**
 * Converts numeric bounds back into a selection using the current rows and columns.
 */
function boundsToSelection(bounds, rows, columns) {
    const startRow = rows[bounds.minRow];
    const endRow = rows[bounds.maxRow];
    const startColumn = columns[bounds.minColumn];
    const endColumn = columns[bounds.maxColumn];
    if (!startRow || !endRow || !startColumn || !endColumn) {
        return null;
    }
    return {
        start: {
            rowId: startRow.id,
            columnId: startColumn.id,
        },
        end: {
            rowId: endRow.id,
            columnId: endColumn.id,
        },
    };
}
/**
 * Returns how many cells are covered by rectangular bounds.
 */
function getBoundsArea(bounds) {
    return (bounds.maxRow - bounds.minRow + 1) * (bounds.maxColumn - bounds.minColumn + 1);
}
/**
 * Returns how many cells two rectangular bounds share.
 */
function getOverlapArea(a, b) {
    const overlapWidth = Math.max(0, Math.min(a.maxColumn, b.maxColumn) - Math.max(a.minColumn, b.minColumn) + 1);
    const overlapHeight = Math.max(0, Math.min(a.maxRow, b.maxRow) - Math.max(a.minRow, b.minRow) + 1);
    return overlapWidth * overlapHeight;
}
/**
 * Builds the smallest rectangle that contains every bounds in the list.
 */
function getBoundingBounds(boundsList) {
    return boundsList.reduce((acc, bounds) => ({
        minRow: Math.min(acc.minRow, bounds.minRow),
        maxRow: Math.max(acc.maxRow, bounds.maxRow),
        minColumn: Math.min(acc.minColumn, bounds.minColumn),
        maxColumn: Math.max(acc.maxColumn, bounds.maxColumn),
    }), { ...boundsList[0] });
}
/**
 * Checks whether two bounds can be combined into one rectangle without changing covered cells.
 */
function canMergeBounds(a, b) {
    const mergedBounds = getBoundingBounds([a, b]);
    const mergedArea = getBoundsArea(mergedBounds);
    const unionArea = getBoundsArea(a) + getBoundsArea(b) - getOverlapArea(a, b);
    return mergedArea === unionArea;
}
/**
 * Merges adjacent or overlapping selections into the simplest rectangular set.
 */
function normalizeSelections(selections, rows, columns, rowIndexMap, columnIndexMap) {
    const normalizedBounds = toSelectionBoundsList(selections, rowIndexMap, columnIndexMap);
    let didMerge = true;
    while (didMerge) {
        didMerge = false;
        for (let index = 0; index < normalizedBounds.length; index += 1) {
            for (let candidateIndex = index + 1; candidateIndex < normalizedBounds.length; candidateIndex += 1) {
                const currentBounds = normalizedBounds[index];
                const candidateBounds = normalizedBounds[candidateIndex];
                if (!canMergeBounds(currentBounds, candidateBounds)) {
                    continue;
                }
                normalizedBounds[index] = getBoundingBounds([currentBounds, candidateBounds]);
                normalizedBounds.splice(candidateIndex, 1);
                didMerge = true;
                break;
            }
            if (didMerge) {
                break;
            }
        }
    }
    return normalizedBounds
        .map((bounds) => boundsToSelection(bounds, rows, columns))
        .filter((selection) => selection !== null);
}
/**
 * Picks the active selection that still matches the normalized selection set.
 */
function resolveActiveSelection(selections, activeSelection, rowIndexMap, columnIndexMap) {
    const lastSelection = selections.length > 0 ? selections[selections.length - 1] : null;
    if (!activeSelection) {
        return null;
    }
    const activeBounds = getSelectionBounds(activeSelection, rowIndexMap, columnIndexMap);
    if (!activeBounds) {
        return lastSelection;
    }
    return (selections.find((selection) => {
        const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
        if (!bounds) {
            return false;
        }
        return containsBounds(bounds, activeBounds);
    }) ??
        lastSelection ??
        null);
}
/**
 * Checks whether two rectangles overlap at all.
 */
function intersects(a, b) {
    return !(a.maxRow < b.minRow || a.minRow > b.maxRow || a.maxColumn < b.minColumn || a.minColumn > b.maxColumn);
}
/**
 * Removes one rectangular area from another and returns the remaining rectangles.
 */
function subtractBounds(base, cut) {
    if (!intersects(base, cut)) {
        return [base];
    }
    const overlapMinRow = Math.max(base.minRow, cut.minRow);
    const overlapMaxRow = Math.min(base.maxRow, cut.maxRow);
    const overlapMinColumn = Math.max(base.minColumn, cut.minColumn);
    const overlapMaxColumn = Math.min(base.maxColumn, cut.maxColumn);
    const nextBounds = [];
    if (base.minRow < overlapMinRow) {
        nextBounds.push({
            minRow: base.minRow,
            maxRow: overlapMinRow - 1,
            minColumn: base.minColumn,
            maxColumn: base.maxColumn,
        });
    }
    if (overlapMaxRow < base.maxRow) {
        nextBounds.push({
            minRow: overlapMaxRow + 1,
            maxRow: base.maxRow,
            minColumn: base.minColumn,
            maxColumn: base.maxColumn,
        });
    }
    if (base.minColumn < overlapMinColumn) {
        nextBounds.push({
            minRow: overlapMinRow,
            maxRow: overlapMaxRow,
            minColumn: base.minColumn,
            maxColumn: overlapMinColumn - 1,
        });
    }
    if (overlapMaxColumn < base.maxColumn) {
        nextBounds.push({
            minRow: overlapMinRow,
            maxRow: overlapMaxRow,
            minColumn: overlapMaxColumn + 1,
            maxColumn: base.maxColumn,
        });
    }
    return nextBounds;
}
/**
 * Removes a selection from the current selection set.
 */
function subtractSelection(selections, cut, rows, columns, rowIndexMap, columnIndexMap) {
    const cutBounds = getSelectionBounds(cut, rowIndexMap, columnIndexMap);
    if (!cutBounds) {
        return selections;
    }
    return selections.flatMap((selection) => {
        const selectionBounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
        if (!selectionBounds) {
            return [];
        }
        return subtractBounds(selectionBounds, cutBounds)
            .map((bounds) => boundsToSelection(bounds, rows, columns))
            .filter((nextSelection) => nextSelection !== null);
    });
}
/**
 * Checks whether a specific cell is covered by any current selection.
 */
function isCellSelected(rowId, columnId, selections, rowIndexMap, columnIndexMap) {
    const rowIndex = rowIndexMap[rowId];
    const columnIndex = columnIndexMap[columnId];
    if (rowIndex === undefined || columnIndex === undefined) {
        return false;
    }
    return selections.some((selection) => {
        const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
        if (!bounds) {
            return false;
        }
        return containsCell(bounds, rowIndex, columnIndex);
    });
}
/**
 * Produces a stable string key for a selection.
 */
function getSelectionKey(selection) {
    if (!selection) {
        return "selection:unknown";
    }
    return `${selection.start.rowId}:${selection.start.columnId}:${selection.end.rowId}:${selection.end.columnId}`;
}
/**
 * Produces a stable string key for one cell coordinate.
 */
function toCoordinateKey(coordinates) {
    return `${coordinates.rowId}:${coordinates.columnId}`;
}
Object.assign(exports,{buildIndexMap,getSelectionBounds,boundsToSelection,getBoundsArea,getOverlapArea,getBoundingBounds,canMergeBounds,normalizeSelections,resolveActiveSelection,intersects,subtractBounds,subtractSelection,isCellSelected,getSelectionKey,toCoordinateKey});},"core/copy-plan.js":function(exports,__require){const { buildIndexMap,getSelectionBounds } = __require("core/geometry.js");
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
function resolveCopySelection(selections, activeSelection, rows, columns) {
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
function copySelectionToText(plan, rows, columns, getCellValue) {
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
Object.assign(exports,{resolveCopySelection,copySelectionToText});},"core/persistence.js":function(exports,__require){const { boundsToSelection,buildIndexMap,getSelectionBounds,normalizeSelections,resolveActiveSelection } = __require("core/geometry.js");
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
function snapshotSelectionState(selections, activeSelection, rows, columns) {
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
function restoreSelectionState(snapshot, rows, columns) {
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
Object.assign(exports,{snapshotSelectionState,restoreSelectionState});},"dom/clipboard.js":function(exports,__require){/**
 * Copies text and optional HTML with the legacy textarea-based clipboard fallback.
 */
function copyTextWithExecCommand(payload) {
    const textarea = document.createElement("textarea");
    textarea.value = payload.text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const handleCopy = (event) => {
        if (!event.clipboardData) {
            return;
        }
        event.preventDefault();
        event.clipboardData.setData("text/plain", payload.text);
        if (payload.html) {
            event.clipboardData.setData("text/html", payload.html);
        }
    };
    document.addEventListener("copy", handleCopy, true);
    try {
        return document.execCommand("copy");
    }
    catch (error) {
        console.warn("Copy to clipboard failed", error);
        return false;
    }
    finally {
        document.removeEventListener("copy", handleCopy, true);
        textarea.remove();
    }
}
/**
 * Copies text and optional HTML to the clipboard, using the modern API first and a fallback second.
 */
async function copyTextToClipboard(text, html) {
    if (window.isSecureContext && navigator.clipboard) {
        try {
            if (html && typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/plain": new Blob([text], { type: "text/plain" }),
                        "text/html": new Blob([html], { type: "text/html" }),
                    }),
                ]);
            }
            else {
                await navigator.clipboard.writeText(text);
            }
            return true;
        }
        catch (error) {
            console.warn("Copy to clipboard failed", error);
        }
    }
    return copyTextWithExecCommand({ text, html });
}
Object.assign(exports,{copyTextToClipboard});},"dom/focus-state.js":function(exports,__require){const { getSelectionBounds } = __require("core/geometry.js");
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
function resolveSelectionFocusState(activeSelection, previousSelectedCell, previousRangeAnchorCell, rowIndexMap, columnIndexMap) {
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
Object.assign(exports,{resolveSelectionFocusState});},"dom/interaction-mode.js":function(exports,__require){function getDefaultEnvironment() {
    return {
        matchMedia: typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined,
        maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
    };
}
/**
 * Resolves the runtime interaction policy for the current device.
 */
function resolveInteractionMode(interactionMode = "auto", environment = getDefaultEnvironment()) {
    if (interactionMode !== "auto") {
        return interactionMode;
    }
    const hasCoarsePointer = Boolean(environment.matchMedia?.("(pointer: coarse)").matches || environment.matchMedia?.("(any-pointer: coarse)").matches);
    const lacksHover = Boolean(environment.matchMedia?.("(hover: none)").matches);
    const maxTouchPoints = environment.maxTouchPoints ?? 0;
    if (hasCoarsePointer || (maxTouchPoints > 0 && lacksHover)) {
        return "touch";
    }
    return "desktop";
}
Object.assign(exports,{resolveInteractionMode});},"dom/overlay.js":function(exports,__require){const DEFAULT_OVERLAY_THEME = {
    selectionFill: "rgba(27, 114, 232, 0.10)",
    selectionStroke: "rgb(27 114 232)",
    copiedOutline: "rgb(27 114 232)",
    copiedOutlineWidth: 1.5,
    zIndex: 40,
};
/**
 * Applies absolute positioning styles for one overlay rectangle.
 */
function setRectStyles(element, rect) {
    element.style.position = "absolute";
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
}
/**
 * Creates one full-screen overlay layer.
 */
function createLayer() {
    const layer = document.createElement("div");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    return layer;
}
/**
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect, selectionStroke, selectionFill) {
    const fill = document.createElement("div");
    setRectStyles(fill, rect);
    fill.style.background = selectionFill;
    fill.style.boxShadow = `inset 0 0 0 1px ${selectionStroke}`;
    return fill;
}
/**
 * Creates the dashed outline used for copied selections.
 */
function createCopiedRing(rect, copiedOutline, copiedOutlineWidth) {
    const ring = document.createElement("div");
    setRectStyles(ring, rect);
    ring.style.outline = `${copiedOutlineWidth}px dashed ${copiedOutline}`;
    ring.style.outlineOffset = "0";
    return ring;
}
class SelectionOverlay {
    /**
     * Creates the overlay root and its rendering layers.
     */
    constructor(theme = {}) {
        this.theme = { ...DEFAULT_OVERLAY_THEME, ...theme };
        this.root = document.createElement("div");
        this.fillLayer = createLayer();
        this.ringLayer = createLayer();
        this.root.setAttribute("aria-hidden", "true");
        this.root.style.position = "fixed";
        this.root.style.inset = "0";
        this.root.style.pointerEvents = "none";
        this.root.style.zIndex = String(this.theme.zIndex);
        this.root.append(this.fillLayer, this.ringLayer);
        document.body.appendChild(this.root);
    }
    /**
     * Renders committed selections, copied outlines, and an optional drag preview.
     */
    render(selectionRects, copiedRects, dragRect) {
        const fillRects = selectionRects.map((rect) => createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill));
        if (dragRect) {
            const dragFill = document.createElement("div");
            setRectStyles(dragFill, dragRect);
            dragFill.style.background = this.theme.selectionFill;
            fillRects.push(dragFill);
        }
        const copiedRings = copiedRects.map((rect) => createCopiedRing(rect, this.theme.copiedOutline, this.theme.copiedOutlineWidth));
        this.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
        this.fillLayer.replaceChildren(...fillRects);
        this.ringLayer.replaceChildren(...copiedRings);
    }
    /**
     * Removes the overlay from the document.
     */
    destroy() {
        this.root.remove();
    }
}
Object.assign(exports,{SelectionOverlay,DEFAULT_OVERLAY_THEME});},"dom/table-model.js":function(exports,__require){/**
 * Flattens cell text into a single spreadsheet-friendly line.
 */
function normalizeCellText(text) {
    return text.replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
/**
 * Reads the default text value to use for copy output.
 */
function defaultGetCellText(cell) {
    const text = cell.innerText ?? cell.textContent ?? "";
    return normalizeCellText(text);
}
/**
 * Builds the stable id used for one logical row.
 */
function getRowId(index) {
    return `row-${index}`;
}
/**
 * Builds the stable id used for one logical column.
 */
function getColumnId(index) {
    return `column-${index}`;
}
/**
 * Ensures the backing grid has a row array at the requested index.
 */
function ensureGridRow(grid, rowIndex) {
    grid[rowIndex] ?? (grid[rowIndex] = []);
    return grid[rowIndex];
}
/**
 * Finds the next free logical column in a grid row.
 */
function getNextAvailableColumn(gridRow, startIndex) {
    let columnIndex = startIndex;
    while (gridRow[columnIndex]) {
        columnIndex += 1;
    }
    return columnIndex;
}
/**
 * Registers every logical coordinate covered by one DOM cell and its spans.
 */
function registerCellAliases(cell, grid, rowSpan, colSpan, copyValue, cellByCoordinate, copyValueByCoordinate) {
    let maxColumnCount = 0;
    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const aliasRowIndex = cell.rowIndex + rowOffset;
        const gridRow = ensureGridRow(grid, aliasRowIndex);
        for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
            const aliasColumnIndex = cell.columnIndex + columnOffset;
            const alias = {
                rowId: getRowId(aliasRowIndex),
                columnId: getColumnId(aliasColumnIndex),
            };
            const coordinateKey = getCoordinateKey(alias.rowId, alias.columnId);
            cell.aliases.push(alias);
            gridRow[aliasColumnIndex] = cell;
            cellByCoordinate.set(coordinateKey, cell);
            copyValueByCoordinate.set(coordinateKey, rowOffset === 0 && columnOffset === 0 ? copyValue : "");
            maxColumnCount = Math.max(maxColumnCount, aliasColumnIndex + 1);
        }
    }
    return maxColumnCount;
}
/**
 * Builds a stable map key for one logical table coordinate.
 */
function getCoordinateKey(rowId, columnId) {
    return `${rowId}:${columnId}`;
}
/**
 * Builds a logical table model from the current DOM table structure.
 */
function buildDOMTableModel(table, options = {}) {
    const getCellText = options.getCellText ?? defaultGetCellText;
    const rowElements = Array.from(table.rows);
    const rows = rowElements.map((_, index) => ({ id: getRowId(index) }));
    const grid = [];
    const cells = [];
    const cellByCoordinate = new Map();
    const copyValueByCoordinate = new Map();
    let maxColumnCount = 0;
    rowElements.forEach((rowElement, rowIndex) => {
        const gridRow = ensureGridRow(grid, rowIndex);
        let searchColumnIndex = 0;
        Array.from(rowElement.cells).forEach((cellElement, cellIndex) => {
            const columnIndex = getNextAvailableColumn(gridRow, searchColumnIndex);
            const rowSpan = Math.max(1, cellElement.rowSpan || 1);
            const colSpan = Math.max(1, cellElement.colSpan || 1);
            const cell = {
                id: `cell-${rowIndex}-${columnIndex}-${cellIndex}`,
                rowId: getRowId(rowIndex),
                columnId: getColumnId(columnIndex),
                rowIndex,
                columnIndex,
                element: cellElement,
                aliases: [],
            };
            cells.push(cell);
            const copyValue = getCellText(cellElement);
            maxColumnCount = Math.max(maxColumnCount, registerCellAliases(cell, grid, rowSpan, colSpan, copyValue, cellByCoordinate, copyValueByCoordinate));
            searchColumnIndex = columnIndex + colSpan;
        });
    });
    const columns = Array.from({ length: maxColumnCount }, (_, index) => ({ id: getColumnId(index) }));
    return {
        rows,
        columns,
        cells,
        cellByCoordinate,
        copyValueByCoordinate,
    };
}
Object.assign(exports,{getCoordinateKey,buildDOMTableModel});},"dom/enhance-table.js":function(exports,__require){const { copySelectionToText,resolveCopySelection } = __require("core/copy-plan.js");
const { buildIndexMap,getSelectionBounds,getSelectionKey,isCellSelected,normalizeSelections,resolveActiveSelection,subtractSelection } = __require("core/geometry.js");
const { restoreSelectionState,snapshotSelectionState } = __require("core/persistence.js");
const { copyTextToClipboard } = __require("dom/clipboard.js");
const { resolveSelectionFocusState } = __require("dom/focus-state.js");
const { resolveInteractionMode } = __require("dom/interaction-mode.js");
const { SelectionOverlay } = __require("dom/overlay.js");
const { buildDOMTableModel,getCoordinateKey } = __require("dom/table-model.js");
const IGNORE_INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[data-spreadsheet-ignore]",
].join(",");
const MANAGED_CELL_ATTRIBUTE = "data-table-steroids-cell";
const MANAGED_CELL_STYLE_ID = "table-steroids-cell-style";
const MANAGED_TABLE_ATTRIBUTE = "data-table-steroids";
/**
 * Installs the shared stylesheet used by managed spreadsheet cells.
 */
function ensureManagedCellStyles() {
    if (document.getElementById(MANAGED_CELL_STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = MANAGED_CELL_STYLE_ID;
    style.textContent = `
    [${MANAGED_CELL_ATTRIBUTE}="true"] {
      -webkit-tap-highlight-color: transparent;
      outline: none !important;
      outline-offset: 0 !important;
    }

    [${MANAGED_CELL_ATTRIBUTE}="true"]:focus,
    [${MANAGED_CELL_ATTRIBUTE}="true"]:focus-visible {
      outline: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
  `;
    document.head.appendChild(style);
}
/**
 * Restores a managed cell back to its original focus-related attributes.
 */
function restoreManagedCell(cellElement, previousTabIndex) {
    if (previousTabIndex === null) {
        cellElement.removeAttribute("tabindex");
    }
    else {
        cellElement.setAttribute("tabindex", previousTabIndex);
    }
    cellElement.removeAttribute(MANAGED_CELL_ATTRIBUTE);
}
/**
 * Narrows an event target to a DOM element.
 */
function isElement(value) {
    return value instanceof Element;
}
/**
 * Resolves the spreadsheet cell associated with an event target.
 */
function getEventCell(target, table, cellByElement) {
    if (!isElement(target)) {
        return null;
    }
    const cellElement = target.closest("th,td");
    if (!(cellElement instanceof HTMLTableCellElement) || !table.contains(cellElement)) {
        return null;
    }
    return cellByElement.get(cellElement) ?? null;
}
/**
 * Resolves the spreadsheet cell under a viewport coordinate.
 */
function getCellFromPoint(clientX, clientY, table, cellByElement) {
    return getEventCell(document.elementFromPoint(clientX, clientY), table, cellByElement);
}
/**
 * Checks whether an event target should be ignored for spreadsheet interactions.
 */
function shouldIgnoreTarget(target, cellElement) {
    if (!isElement(target)) {
        return false;
    }
    const interactiveElement = target.closest(IGNORE_INTERACTIVE_SELECTOR);
    return interactiveElement !== null && cellElement.contains(interactiveElement);
}
/**
 * Converts a DOM table cell model into selection coordinates.
 */
function getCellCoordinates(cell) {
    return {
        rowId: cell.rowId,
        columnId: cell.columnId,
    };
}
/**
 * Creates a selection from two endpoint coordinates.
 */
function createSelection(start, end) {
    return { start, end };
}
/**
 * Creates a deep copy of one selection object.
 */
function cloneSelection(selection) {
    return {
        start: { ...selection.start },
        end: { ...selection.end },
    };
}
/**
 * Creates deep copies of a selection list.
 */
function cloneSelections(selections) {
    return selections.map(cloneSelection);
}
/**
 * Returns the final selection in a list, if any.
 */
function getLastSelection(selections) {
    return selections.length > 0 ? selections[selections.length - 1] : null;
}
/**
 * Creates one clipboard cell for the copied HTML table payload.
 */
function createClipboardHtmlCell(model, rowId, columnId) {
    const clipboardCell = document.createElement("td");
    const sourceCell = model.cellByCoordinate.get(getCoordinateKey(rowId, columnId));
    clipboardCell.style.whiteSpace = "pre-wrap";
    if (!sourceCell) {
        return clipboardCell;
    }
    if (sourceCell.rowId === rowId && sourceCell.columnId === columnId) {
        try {
            clipboardCell.append(...Array.from(sourceCell.element.childNodes, (node) => node.cloneNode(true)));
        }
        catch {
            clipboardCell.textContent = sourceCell.element.textContent ?? "";
        }
    }
    return clipboardCell;
}
/**
 * Appends one rectangular selection to the clipboard HTML table.
 */
function appendClipboardHtmlRows(bodyElement, selection, model) {
    model.rows.slice(selection.minRow, selection.maxRow + 1).forEach((row) => {
        const rowElement = document.createElement("tr");
        model.columns.slice(selection.minColumn, selection.maxColumn + 1).forEach((column) => {
            rowElement.appendChild(createClipboardHtmlCell(model, row.id, column.id));
        });
        bodyElement.appendChild(rowElement);
    });
}
/**
 * Builds an HTML table version of the current copy payload for spreadsheet pastes.
 */
function buildClipboardHtml(plan, model) {
    if (!plan) {
        return undefined;
    }
    const indexedSelections = plan.selections
        .map((selection) => getSelectionBounds(selection, buildIndexMap(model.rows), buildIndexMap(model.columns)))
        .filter((selection) => selection !== null);
    const firstSelection = indexedSelections[0];
    if (!firstSelection) {
        return undefined;
    }
    const tableElement = document.createElement("table");
    const bodyElement = document.createElement("tbody");
    if (plan.mode === "single") {
        appendClipboardHtmlRows(bodyElement, firstSelection, model);
    }
    else if (plan.mode === "horizontal") {
        model.rows.slice(firstSelection.minRow, firstSelection.maxRow + 1).forEach((row) => {
            const rowElement = document.createElement("tr");
            indexedSelections.forEach((selection) => {
                model.columns.slice(selection.minColumn, selection.maxColumn + 1).forEach((column) => {
                    rowElement.appendChild(createClipboardHtmlCell(model, row.id, column.id));
                });
            });
            bodyElement.appendChild(rowElement);
        });
    }
    else {
        indexedSelections.forEach((selection) => {
            appendClipboardHtmlRows(bodyElement, selection, model);
        });
    }
    tableElement.appendChild(bodyElement);
    return tableElement.outerHTML;
}
/**
 * Measures the painted pixel edges for a table cell.
 */
function getMeasuredCellEdges(cell) {
    const cellRect = cell.getBoundingClientRect();
    const rowRect = cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.getBoundingClientRect() : null;
    return {
        left: Math.floor(cellRect.left),
        top: Math.floor(Math.min(cellRect.top, rowRect?.top ?? cellRect.top)),
        right: Math.ceil(cellRect.right),
        bottom: Math.ceil(Math.max(cellRect.bottom, rowRect?.bottom ?? cellRect.bottom)),
    };
}
/**
 * Checks whether a rendered table cell overlaps a selection's logical bounds.
 */
function cellIntersectsSelectionBounds(cell, bounds, rowIndexMap, columnIndexMap) {
    return cell.aliases.some((alias) => {
        const rowIndex = rowIndexMap[alias.rowId];
        const columnIndex = columnIndexMap[alias.columnId];
        if (rowIndex === undefined || columnIndex === undefined) {
            return false;
        }
        return (rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow && columnIndex >= bounds.minColumn && columnIndex <= bounds.maxColumn);
    });
}
/**
 * Measures the on-screen rectangle covered by a logical selection.
 */
function getOverlayRect(selection, model, rowIndexMap, columnIndexMap) {
    const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
    if (!bounds) {
        return null;
    }
    const selectedCells = model.cells.filter((cell) => cellIntersectsSelectionBounds(cell, bounds, rowIndexMap, columnIndexMap));
    if (selectedCells.length === 0) {
        return null;
    }
    const selectionEdges = selectedCells.reduce((edges, cell) => {
        const measuredEdges = getMeasuredCellEdges(cell.element);
        return {
            left: Math.min(edges.left, measuredEdges.left),
            top: Math.min(edges.top, measuredEdges.top),
            right: Math.max(edges.right, measuredEdges.right),
            bottom: Math.max(edges.bottom, measuredEdges.bottom),
        };
    }, getMeasuredCellEdges(selectedCells[0].element));
    const width = selectionEdges.right - selectionEdges.left;
    const height = selectionEdges.bottom - selectionEdges.top;
    if (width <= 0 || height <= 0) {
        return null;
    }
    return {
        left: selectionEdges.left,
        top: selectionEdges.top,
        width,
        height,
    };
}
/**
 * Enhances one table element with spreadsheet-style selection behavior.
 */
function enhanceTable(table, options = {}) {
    const enhancedTable = table;
    if (enhancedTable.__nativeSpreadsheetHandle__) {
        enhancedTable.__nativeSpreadsheetHandle__.refresh();
        return enhancedTable.__nativeSpreadsheetHandle__;
    }
    const allowCellSelection = options.allowCellSelection ?? true;
    const allowRangeSelection = options.allowRangeSelection ?? true;
    const interactionMode = resolveInteractionMode(options.interactionMode);
    const observeMutations = options.observeMutations ?? true;
    const overlay = new SelectionOverlay(options.overlay);
    const managedCells = new Map();
    const cellByElement = new WeakMap();
    let model = buildDOMTableModel(table, { getCellText: options.getCellText });
    let rowIndexMap = buildIndexMap(model.rows);
    let columnIndexMap = buildIndexMap(model.columns);
    let selectionRanges = [];
    let activeSelection = null;
    let copiedSelectionKeys = [];
    let selectedCell = null;
    let rangeAnchorCell = null;
    let dragState = null;
    let frameId = null;
    let bodyUserSelectValue = null;
    const previousTouchAction = table.style.touchAction;
    ensureManagedCellStyles();
    table.setAttribute(MANAGED_TABLE_ATTRIBUTE, "true");
    if (interactionMode === "touch") {
        table.style.touchAction = "none";
    }
    /**
     * Emits the current selection state through the external callback.
     */
    const emitSelectionChange = () => {
        options.onSelectionChange?.(cloneSelections(selectionRanges), activeSelection ? cloneSelection(activeSelection) : null);
    };
    /**
     * Builds the current copy payload for the active selection state.
     */
    const getCopyPayload = (selections, activeSelectionForPlan) => {
        const plan = resolveCopySelection(selections, activeSelectionForPlan, model.rows, model.columns);
        if (!plan) {
            return null;
        }
        return {
            plan,
            text: copySelectionToText(plan, model.rows, model.columns, (rowId, columnId) => model.copyValueByCoordinate.get(getCoordinateKey(rowId, columnId)) ?? ""),
            html: buildClipboardHtml(plan, model),
        };
    };
    /**
     * Recomputes the focused cell and range anchor from the current selection state.
     */
    const syncFocusState = (nextActiveSelection, previousSelectedCell, previousRangeAnchorCell) => {
        const focusState = resolveSelectionFocusState(nextActiveSelection, previousSelectedCell, previousRangeAnchorCell, rowIndexMap, columnIndexMap);
        selectedCell = focusState.selectedCell;
        rangeAnchorCell = focusState.rangeAnchorCell;
    };
    /**
     * Copies the current selections and updates copied-selection UI state.
     */
    const copySelectionsToClipboard = async (selections, activeSelectionForPlan) => {
        const copyPayload = getCopyPayload(selections, activeSelectionForPlan);
        if (!copyPayload) {
            return false;
        }
        const copied = await copyTextToClipboard(copyPayload.text, copyPayload.html);
        if (!copied) {
            return false;
        }
        options.onSelectionCopy?.(copyPayload.text, copyPayload.plan.selections);
        copiedSelectionKeys = copyPayload.plan.selections.map((selection) => getSelectionKey(selection));
        scheduleOverlayRender();
        return true;
    };
    /**
     * Starts a drag interaction for range selection.
     */
    const startDragSelection = (pointerId, pointerType, selection, anchor, mode, baseSelections) => {
        dragState = {
            pointerId,
            pointerType,
            anchor,
            selection,
            mode,
            baseSelections,
            lastHoveredCoordinateKey: getCoordinateKey(selection.end.rowId, selection.end.columnId),
        };
        setIsDraggingDocument(true);
        scheduleOverlayRender();
    };
    /**
     * Clears the active drag interaction and restores document selection behavior.
     */
    const stopDragSelection = (shouldRender = true) => {
        dragState = null;
        setIsDraggingDocument(false);
        if (shouldRender) {
            scheduleOverlayRender();
        }
    };
    /**
     * Keeps managed cell focus attributes aligned with the current table model.
     */
    const syncFocusableCells = (nextModel) => {
        const nextElements = new Set(nextModel.cells.map((cell) => cell.element));
        nextModel.cells.forEach((cell) => {
            cellByElement.set(cell.element, cell);
            if (!managedCells.has(cell.element)) {
                managedCells.set(cell.element, cell.element.getAttribute("tabindex"));
                cell.element.setAttribute("tabindex", "-1");
                cell.element.setAttribute(MANAGED_CELL_ATTRIBUTE, "true");
            }
        });
        Array.from(managedCells.entries()).forEach(([cellElement, previousTabIndex]) => {
            if (nextElements.has(cellElement)) {
                return;
            }
            if (cellElement.isConnected) {
                restoreManagedCell(cellElement, previousTabIndex);
            }
            managedCells.delete(cellElement);
        });
    };
    /**
     * Rebuilds the overlay rectangles for committed and in-progress selections.
     */
    const renderOverlay = () => {
        const selectionRects = selectionRanges
            .map((selection) => {
            const rect = getOverlayRect(selection, model, rowIndexMap, columnIndexMap);
            if (!rect) {
                return null;
            }
            return {
                key: getSelectionKey(selection),
                ...rect,
            };
        })
            .filter((rect) => rect !== null);
        const copiedRects = selectionRects.filter((rect) => copiedSelectionKeys.includes(rect.key));
        const nextDragRect = dragState ? getOverlayRect(dragState.selection, model, rowIndexMap, columnIndexMap) : null;
        overlay.render(selectionRects, copiedRects, nextDragRect ? { key: "drag-selection", ...nextDragRect } : null);
    };
    /**
     * Schedules one overlay render on the next animation frame.
     */
    const scheduleOverlayRender = () => {
        if (frameId !== null) {
            return;
        }
        frameId = window.requestAnimationFrame(() => {
            frameId = null;
            renderOverlay();
        });
    };
    /**
     * Rebuilds the table model and restores selection state against the new structure.
     */
    const rebuildModel = (clearSelection = false) => {
        const selectionSnapshot = clearSelection
            ? null
            : snapshotSelectionState(selectionRanges, activeSelection, model.rows, model.columns);
        const selectedCellSnapshot = clearSelection ? null : selectedCell;
        const rangeAnchorSnapshot = clearSelection ? null : rangeAnchorCell;
        model = buildDOMTableModel(table, { getCellText: options.getCellText });
        rowIndexMap = buildIndexMap(model.rows);
        columnIndexMap = buildIndexMap(model.columns);
        syncFocusableCells(model);
        if (clearSelection) {
            selectionRanges = [];
            activeSelection = null;
            copiedSelectionKeys = [];
            syncFocusState(null, null, null);
            stopDragSelection(false);
        }
        else {
            const restoredState = restoreSelectionState(selectionSnapshot ?? { selections: [], activeSelection: null }, model.rows, model.columns);
            selectionRanges = restoredState.selections;
            activeSelection = restoredState.activeSelection;
            syncFocusState(activeSelection, selectedCellSnapshot, rangeAnchorSnapshot);
        }
        emitSelectionChange();
        scheduleOverlayRender();
    };
    /**
     * Commits a new selection set and refreshes all derived UI state.
     */
    const syncSelections = (nextSelections, nextActiveSelection) => {
        selectionRanges = normalizeSelections(nextSelections, model.rows, model.columns, rowIndexMap, columnIndexMap);
        activeSelection = resolveActiveSelection(selectionRanges, nextActiveSelection, rowIndexMap, columnIndexMap);
        syncFocusState(activeSelection, selectedCell, rangeAnchorCell);
        copiedSelectionKeys = [];
        emitSelectionChange();
        scheduleOverlayRender();
    };
    /**
     * Focuses the DOM cell for a logical table coordinate.
     */
    const focusCell = (rowId, columnId) => {
        const cell = model.cellByCoordinate.get(getCoordinateKey(rowId, columnId));
        cell?.element.focus({ preventScroll: true });
    };
    /**
     * Applies a committed selection according to the current drag mode.
     */
    const applySelection = (selection, mode, baseSelections) => {
        if (mode === "replace") {
            syncSelections([selection], selection);
            return;
        }
        if (mode === "add") {
            const dedupedSelections = subtractSelection(baseSelections, selection, model.rows, model.columns, rowIndexMap, columnIndexMap);
            syncSelections([...dedupedSelections, selection], selection);
            return;
        }
        const nextSelections = subtractSelection(baseSelections, selection, model.rows, model.columns, rowIndexMap, columnIndexMap);
        syncSelections(nextSelections, getLastSelection(nextSelections));
    };
    /**
     * Temporarily disables document text selection while dragging.
     */
    const setIsDraggingDocument = (nextValue) => {
        if (nextValue) {
            if (bodyUserSelectValue === null) {
                bodyUserSelectValue = document.body.style.userSelect;
            }
            document.body.style.userSelect = "none";
            return;
        }
        if (bodyUserSelectValue !== null) {
            document.body.style.userSelect = bodyUserSelectValue;
            bodyUserSelectValue = null;
        }
    };
    /**
     * Handles keyboard navigation and shift-range expansion inside the table.
     */
    const handleCellKeyDown = (event) => {
        if (!allowCellSelection || interactionMode !== "desktop") {
            return;
        }
        const cell = getEventCell(event.target, table, cellByElement);
        if (!cell || shouldIgnoreTarget(event.target, cell.element)) {
            return;
        }
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const currentCell = selectedCell ?? activeSelection?.end ?? getCellCoordinates(cell);
        const currentRowIndex = rowIndexMap[currentCell.rowId];
        const currentColumnIndex = columnIndexMap[currentCell.columnId];
        if (currentRowIndex === undefined || currentColumnIndex === undefined) {
            return;
        }
        let nextRowIndex = currentRowIndex;
        let nextColumnIndex = currentColumnIndex;
        if (event.key === "ArrowUp") {
            nextRowIndex = Math.max(0, currentRowIndex - 1);
        }
        if (event.key === "ArrowDown") {
            nextRowIndex = Math.min(model.rows.length - 1, currentRowIndex + 1);
        }
        if (event.key === "ArrowLeft") {
            nextColumnIndex = Math.max(0, currentColumnIndex - 1);
        }
        if (event.key === "ArrowRight") {
            nextColumnIndex = Math.min(model.columns.length - 1, currentColumnIndex + 1);
        }
        const nextCell = {
            rowId: model.rows[nextRowIndex]?.id,
            columnId: model.columns[nextColumnIndex]?.id,
        };
        if (!nextCell.rowId || !nextCell.columnId) {
            return;
        }
        selectedCell = nextCell;
        if (event.shiftKey) {
            const nextRangeAnchor = rangeAnchorCell ?? currentCell;
            rangeAnchorCell = nextRangeAnchor;
            const nextSelection = createSelection(nextRangeAnchor, nextCell);
            syncSelections([nextSelection], nextSelection);
            focusCell(nextCell.rowId, nextCell.columnId);
            return;
        }
        const nextSelection = createSelection(nextCell, nextCell);
        rangeAnchorCell = nextCell;
        syncSelections([nextSelection], nextSelection);
        focusCell(nextCell.rowId, nextCell.columnId);
    };
    /**
     * Starts pointer-based selection interactions for both mouse and touch input.
     */
    const handleTablePointerDown = (event) => {
        if ((!allowCellSelection && !allowRangeSelection) || !event.isPrimary) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        const cell = getEventCell(event.target, table, cellByElement);
        if (!cell || shouldIgnoreTarget(event.target, cell.element)) {
            return;
        }
        event.preventDefault();
        const nextCell = getCellCoordinates(cell);
        const rangeAnchor = rangeAnchorCell ?? selectedCell ?? activeSelection?.end;
        const nextSelection = createSelection(nextCell, nextCell);
        const allowsDesktopMultiSelect = interactionMode === "desktop";
        const isToggleSelection = allowsDesktopMultiSelect && (event.metaKey || event.ctrlKey);
        const isRangeExtension = allowRangeSelection && allowsDesktopMultiSelect && event.shiftKey && rangeAnchor && !isToggleSelection;
        if (isRangeExtension && rangeAnchor) {
            selectedCell = nextCell;
            rangeAnchorCell = rangeAnchor;
            startDragSelection(event.pointerId, event.pointerType, createSelection(rangeAnchor, nextCell), rangeAnchor, "replace", []);
            table.setPointerCapture?.(event.pointerId);
            return;
        }
        const mode = isToggleSelection
            ? isCellSelected(nextCell.rowId, nextCell.columnId, selectionRanges, rowIndexMap, columnIndexMap)
                ? "subtract"
                : "add"
            : "replace";
        selectedCell = nextCell;
        rangeAnchorCell = nextCell;
        startDragSelection(event.pointerId, event.pointerType, nextSelection, nextCell, mode, selectionRanges);
        table.setPointerCapture?.(event.pointerId);
    };
    /**
     * Updates the in-progress selection while a pointer drag is active.
     */
    const handleTablePointerMove = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId || !allowRangeSelection) {
            return;
        }
        const cell = getCellFromPoint(event.clientX, event.clientY, table, cellByElement) ?? getEventCell(event.target, table, cellByElement);
        if (!cell) {
            return;
        }
        if (dragState.pointerType !== "mouse") {
            event.preventDefault();
        }
        const coordinate = getCellCoordinates(cell);
        const coordinateKey = getCoordinateKey(coordinate.rowId, coordinate.columnId);
        if (coordinateKey === dragState.lastHoveredCoordinateKey) {
            return;
        }
        dragState = {
            ...dragState,
            selection: createSelection(dragState.anchor, coordinate),
            lastHoveredCoordinateKey: coordinateKey,
        };
        scheduleOverlayRender();
    };
    /**
     * Finalizes the active pointer selection.
     */
    const commitDragSelection = () => {
        if (!dragState) {
            return;
        }
        const committedSelection = dragState.selection;
        let focusTarget = committedSelection.end;
        applySelection(committedSelection, dragState.mode, dragState.baseSelections);
        if (dragState.mode === "subtract") {
            selectedCell = activeSelection?.end ?? null;
            rangeAnchorCell = selectedCell;
            if (selectedCell) {
                focusTarget = selectedCell;
            }
        }
        else {
            selectedCell = committedSelection.end;
            rangeAnchorCell = committedSelection.start;
        }
        if (interactionMode === "desktop") {
            focusCell(focusTarget.rowId, focusTarget.columnId);
        }
        stopDragSelection();
    };
    /**
     * Commits any active pointer selection when the interaction ends.
     */
    const handleTablePointerUp = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }
        if (dragState.pointerType !== "mouse") {
            event.preventDefault();
        }
        if (table.hasPointerCapture?.(event.pointerId)) {
            table.releasePointerCapture(event.pointerId);
        }
        commitDragSelection();
    };
    /**
     * Cancels any active pointer-driven selection.
     */
    const handleTablePointerCancel = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }
        if (table.hasPointerCapture?.(event.pointerId)) {
            table.releasePointerCapture(event.pointerId);
        }
        stopDragSelection();
    };
    /**
     * Handles document-level copy shortcuts while the table owns focus.
     */
    const handleDocumentKeyDown = async (event) => {
        if (interactionMode !== "desktop") {
            return;
        }
        if (!table.contains(document.activeElement)) {
            return;
        }
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest(IGNORE_INTERACTIVE_SELECTOR)) {
            return;
        }
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") {
            return;
        }
        event.preventDefault();
        await copySelectionsToClipboard(selectionRanges, activeSelection);
    };
    /**
     * Re-renders the overlay when scrolling could move painted rectangles.
     */
    const handleDocumentScroll = () => {
        if (selectionRanges.length === 0 && !dragState) {
            return;
        }
        scheduleOverlayRender();
    };
    const mutationObserver = observeMutations && typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            rebuildModel(false);
        })
        : null;
    const resizeObserver = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleOverlayRender();
        })
        : null;
    syncFocusableCells(model);
    emitSelectionChange();
    scheduleOverlayRender();
    table.addEventListener("keydown", handleCellKeyDown);
    table.addEventListener("pointerdown", handleTablePointerDown);
    table.addEventListener("pointermove", handleTablePointerMove);
    table.addEventListener("pointerup", handleTablePointerUp);
    table.addEventListener("pointercancel", handleTablePointerCancel);
    document.addEventListener("keydown", handleDocumentKeyDown);
    document.addEventListener("scroll", handleDocumentScroll, true);
    window.addEventListener("resize", handleDocumentScroll);
    mutationObserver?.observe(table, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["rowspan", "colspan"],
    });
    resizeObserver?.observe(table);
    const handle = {
        /**
         * Removes spreadsheet behavior and restores the table to its original state.
         */
        destroy() {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
            }
            table.removeEventListener("keydown", handleCellKeyDown);
            table.removeEventListener("pointerdown", handleTablePointerDown);
            table.removeEventListener("pointermove", handleTablePointerMove);
            table.removeEventListener("pointerup", handleTablePointerUp);
            table.removeEventListener("pointercancel", handleTablePointerCancel);
            document.removeEventListener("keydown", handleDocumentKeyDown);
            document.removeEventListener("scroll", handleDocumentScroll, true);
            window.removeEventListener("resize", handleDocumentScroll);
            mutationObserver?.disconnect();
            resizeObserver?.disconnect();
            overlay.destroy();
            stopDragSelection(false);
            Array.from(managedCells.entries()).forEach(([cellElement, previousTabIndex]) => {
                restoreManagedCell(cellElement, previousTabIndex);
            });
            managedCells.clear();
            table.style.touchAction = previousTouchAction;
            table.removeAttribute(MANAGED_TABLE_ATTRIBUTE);
            delete enhancedTable.__nativeSpreadsheetHandle__;
        },
        /**
         * Rebuilds the table model against the current DOM.
         */
        refresh() {
            rebuildModel(false);
        },
        /**
         * Clears all current selections.
         */
        clearSelection() {
            copiedSelectionKeys = [];
            syncSelections([], null);
        },
        /**
         * Returns a cloned snapshot of the current selections.
         */
        getSelections() {
            return cloneSelections(selectionRanges);
        },
        /**
         * Returns a cloned snapshot of the current active selection.
         */
        getActiveSelection() {
            return activeSelection ? cloneSelection(activeSelection) : null;
        },
        /**
         * Returns the resolved interaction mode for this table instance.
         */
        getInteractionMode() {
            return interactionMode;
        },
        /**
         * Copies the current selection state using the same flow as keyboard copy.
         */
        async copySelection() {
            return copySelectionsToClipboard(selectionRanges, activeSelection);
        },
    };
    enhancedTable.__nativeSpreadsheetHandle__ = handle;
    return handle;
}
/**
 * Enhances every matching table under a root and returns a collection handle.
 */
function enhanceTables(root = document, options = {}) {
    const { selector = "table", ...tableOptions } = options;
    const tables = Array.from(root.querySelectorAll(selector)).filter((table) => table instanceof HTMLTableElement);
    const handles = tables.map((table) => enhanceTable(table, tableOptions));
    return {
        destroy() {
            handles.forEach((handle) => handle.destroy());
        },
        refresh() {
            handles.forEach((handle) => handle.refresh());
        },
        async copySelection() {
            const results = await Promise.all(handles.map((handle) => handle.copySelection()));
            return results.some(Boolean);
        },
        handles,
    };
}
Object.assign(exports,{enhanceTable,enhanceTables});},"browser-runtime.js":function(exports,__require){const { enhanceTable,enhanceTables } = __require("dom/enhance-table.js");
const { buildDOMTableModel,getCoordinateKey } = __require("dom/table-model.js");
const { DEFAULT_OVERLAY_THEME } = __require("dom/overlay.js");
const API_GLOBAL_KEY = "TableSteroids";
const PAGE_HANDLE_GLOBAL_KEY = "__tableSteroidsPageHandle__";
function getBrowserGlobal() {
    return globalThis;
}
function enablePage(options = {}) {
    if (typeof document === "undefined") {
        return null;
    }
    const browserGlobal = getBrowserGlobal();
    browserGlobal[PAGE_HANDLE_GLOBAL_KEY]?.destroy();
    const handle = enhanceTables(document, {
        ...options,
        interactionMode: "desktop",
    });
    browserGlobal[PAGE_HANDLE_GLOBAL_KEY] = handle;
    return handle;
}
function disablePage() {
    const browserGlobal = getBrowserGlobal();
    const existingHandle = browserGlobal[PAGE_HANDLE_GLOBAL_KEY];
    if (!existingHandle) {
        return;
    }
    existingHandle.destroy();
    delete browserGlobal[PAGE_HANDLE_GLOBAL_KEY];
}
function togglePage(options = {}) {
    const browserGlobal = getBrowserGlobal();
    if (browserGlobal[PAGE_HANDLE_GLOBAL_KEY]) {
        disablePage();
        return null;
    }
    return enablePage(options);
}
if (typeof window !== "undefined") {
    const api = {
        enhanceTable,
        enhanceTables,
        buildDOMTableModel,
        getCoordinateKey,
        DEFAULT_OVERLAY_THEME,
        enablePage,
        disablePage,
        togglePage,
    };
    getBrowserGlobal()[API_GLOBAL_KEY] = api;
}}};const __cache={};const __require=(id)=>{if(__cache[id])return __cache[id];const factory=__factories[id];if(!factory)throw new Error("Unknown module: "+id);const exports={};__cache[id]=exports;factory(exports,__require);return exports;};__require("browser-runtime.js");})();
