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
    frozenZIndex: 40,
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
 * Rounds the corners of one overlay rectangle so the highlight follows a rounded table edge.
 */
function applyOverlayRadius(element, radius) {
    if (!radius) {
        return;
    }
    element.style.borderRadius = `${radius.tl} ${radius.tr} ${radius.br} ${radius.bl}`;
}
/**
 * Builds the inset box-shadow border for a selection fill.
 *
 * A missing stroke draws the full four-sided border in a single shadow — matching
 * the historical single-layer output byte for byte. A supplied {@link EdgeStroke}
 * emits one inset shadow per enabled edge so an interior seam edge can be dropped.
 */
function strokeShadow(stroke, color) {
    if (!stroke) {
        return `inset 0 0 0 1px ${color}`;
    }
    const shadows = [];
    if (stroke.top) {
        shadows.push(`inset 0 1px 0 0 ${color}`);
    }
    if (stroke.right) {
        shadows.push(`inset -1px 0 0 0 ${color}`);
    }
    if (stroke.bottom) {
        shadows.push(`inset 0 -1px 0 0 ${color}`);
    }
    if (stroke.left) {
        shadows.push(`inset 1px 0 0 0 ${color}`);
    }
    return shadows.length > 0 ? shadows.join(", ") : "none";
}
/**
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect, selectionStroke, selectionFill) {
    const fill = document.createElement("div");
    setRectStyles(fill, rect);
    fill.style.background = selectionFill;
    fill.style.boxShadow = strokeShadow(rect.stroke, selectionStroke);
    applyOverlayRadius(fill, rect.radius);
    return fill;
}
/**
 * Creates the dashed outline used for copied selections.
 *
 * With no stroke override the ring is a single `outline` on all four sides —
 * matching the historical single-layer output. When a copied selection spans the
 * freeze boundary its pieces carry a stroke with the interior seam edge disabled,
 * so the ring falls back to per-side dashed borders to avoid drawing a dashed
 * line down the seam.
 */
function createCopiedRing(rect, copiedOutline, copiedOutlineWidth) {
    const ring = document.createElement("div");
    setRectStyles(ring, rect);
    if (rect.stroke) {
        const edge = (enabled) => (enabled ? `${copiedOutlineWidth}px dashed ${copiedOutline}` : "0");
        ring.style.boxSizing = "border-box";
        ring.style.borderTop = edge(rect.stroke.top);
        ring.style.borderRight = edge(rect.stroke.right);
        ring.style.borderBottom = edge(rect.stroke.bottom);
        ring.style.borderLeft = edge(rect.stroke.left);
    }
    else {
        ring.style.outline = `${copiedOutlineWidth}px dashed ${copiedOutline}`;
        ring.style.outlineOffset = "0";
    }
    return ring;
}
/**
 * Trims one viewport-positioned overlay rectangle to a visible clip boundary.
 */
function clipOverlayRect(rect, clipRect) {
    if (!clipRect) {
        return rect;
    }
    const left = Math.max(rect.left, clipRect.left);
    const top = Math.max(rect.top, clipRect.top);
    const right = Math.min(rect.left + rect.width, clipRect.right);
    const bottom = Math.min(rect.top + rect.height, clipRect.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) {
        return null;
    }
    // Drop a corner's rounding only when the clip eats into the rounded arc itself.
    // A sub-pixel/border trim (e.g. an overflow:hidden wrapper's 1px border, combined with
    // the floor/ceil expansion of the measured rect) must not square off a corner — only a
    // real scroll-clip that cuts at least the corner radius deep should.
    const trimLeft = left - rect.left;
    const trimTop = top - rect.top;
    const trimRight = rect.left + rect.width - right;
    const trimBottom = rect.top + rect.height - bottom;
    const keepCorner = (value, edgeTrimA, edgeTrimB) => {
        const radiusPx = Number.parseFloat(value) || 0;
        return edgeTrimA < radiusPx && edgeTrimB < radiusPx ? value : "0";
    };
    const radius = rect.radius
        ? {
            tl: keepCorner(rect.radius.tl, trimLeft, trimTop),
            tr: keepCorner(rect.radius.tr, trimRight, trimTop),
            br: keepCorner(rect.radius.br, trimRight, trimBottom),
            bl: keepCorner(rect.radius.bl, trimLeft, trimBottom),
        }
        : undefined;
    return {
        ...rect,
        left,
        top,
        width,
        height,
        radius,
    };
}
/**
 * Clips the fixed overlay root itself so outlines cannot bleed past the table viewport.
 */
function setRootClipStyles(root, clipRect) {
    if (!clipRect) {
        root.style.clipPath = "";
        return;
    }
    const rootWidth = root.offsetWidth || Number.parseFloat(root.style.width) || (typeof window.innerWidth === "number" ? window.innerWidth : clipRect.right);
    const rootHeight = root.offsetHeight || Number.parseFloat(root.style.height) || (typeof window.innerHeight === "number" ? window.innerHeight : clipRect.bottom);
    root.style.clipPath = `inset(${clipRect.top}px ${Math.max(0, rootWidth - clipRect.right)}px ${Math.max(0, rootHeight - clipRect.bottom)}px ${clipRect.left}px)`;
}
class SelectionOverlay {
    /**
     * Creates the two stacked overlay roots (scrolling + pinned) and their layers.
     */
    constructor(theme = {}, host = document.body) {
        this.previousHostPosition = null;
        this.theme = { ...DEFAULT_OVERLAY_THEME, ...theme };
        this.host = host;
        this.mode = host === document.body ? "viewport" : "local";
        if (this.mode === "local") {
            const hostPosition = typeof window.getComputedStyle === "function" ? window.getComputedStyle(this.host).position : this.host.style.position;
            if (!hostPosition || hostPosition === "static") {
                this.previousHostPosition = this.host.style.position;
                this.host.style.position = "relative";
            }
        }
        const frozenZIndex = this.theme.frozenZIndex ?? this.theme.zIndex;
        // Append the scrolling layer first so it sits under the pinned layer, and so
        // DOM-order lookups (tests, tooling) resolve the primary root first.
        this.base = this.createRoot("base", this.theme.zIndex);
        this.frozen = this.createRoot("frozen", frozenZIndex);
    }
    /**
     * Builds one overlay root with its fill and ring layers and mounts it on the host.
     */
    createRoot(kind, zIndex) {
        const root = document.createElement("div");
        const stickyBand = kind === "frozen" ? document.createElement("div") : null;
        const surface = stickyBand ?? root;
        const fillLayer = createLayer();
        const ringLayer = createLayer();
        root.setAttribute("aria-hidden", "true");
        root.setAttribute("data-table-steroids-overlay", kind);
        root.style.pointerEvents = "none";
        root.style.zIndex = String(zIndex);
        if (this.mode === "local") {
            root.style.position = "absolute";
            root.style.left = "0";
            root.style.top = "0";
            root.style.width = `${this.host.scrollWidth}px`;
            root.style.height = `${this.host.scrollHeight}px`;
        }
        else {
            root.style.position = "fixed";
            root.style.inset = "0";
        }
        if (stickyBand) {
            stickyBand.style.position = "sticky";
            stickyBand.style.height = "100%";
            stickyBand.style.overflow = "hidden";
            stickyBand.append(fillLayer, ringLayer);
            root.appendChild(stickyBand);
        }
        else {
            root.append(fillLayer, ringLayer);
        }
        this.host.appendChild(root);
        return { root, surface, fillLayer, ringLayer, stickyBand };
    }
    /**
     * Renders the scrolling and pinned overlay layers from their split payloads.
     */
    render(input) {
        this.paintLayer(this.base, input.base);
        this.paintFrozenLayer(input.frozen);
    }
    /**
     * Runs the clip + paint pipeline for one overlay layer.
     */
    paintLayer(layer, input) {
        if (this.mode === "local") {
            layer.root.style.width = `${this.host.scrollWidth}px`;
            layer.root.style.height = `${this.host.scrollHeight}px`;
        }
        setRootClipStyles(layer.root, input.clip);
        const clippedSelectionRects = input.selectionRects
            .map((rect) => clipOverlayRect(rect, input.clip))
            .filter((rect) => rect !== null);
        const clippedCopiedRects = input.copiedRects
            .map((rect) => clipOverlayRect(rect, input.clip))
            .filter((rect) => rect !== null);
        const clippedDragRect = input.dragRect ? clipOverlayRect(input.dragRect, input.clip) : null;
        const fillRects = clippedSelectionRects.map((rect) => createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill));
        if (clippedDragRect) {
            const dragFill = document.createElement("div");
            setRectStyles(dragFill, clippedDragRect);
            dragFill.style.background = this.theme.selectionFill;
            applyOverlayRadius(dragFill, clippedDragRect.radius);
            fillRects.push(dragFill);
        }
        const copiedRings = clippedCopiedRects.map((rect) => createCopiedRing(rect, this.theme.copiedOutline, this.theme.copiedOutlineWidth));
        layer.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
        layer.fillLayer.replaceChildren(...fillRects);
        layer.ringLayer.replaceChildren(...copiedRings);
    }
    /**
     * Paints frozen rectangles inside one horizontally-sticky band. The root stays
     * in vertical content coordinates; only the inner surface participates in
     * horizontal sticky positioning.
     */
    paintFrozenLayer(input) {
        const layer = this.frozen;
        if (this.mode === "local") {
            layer.root.style.width = `${this.host.scrollWidth}px`;
            layer.root.style.height = `${this.host.scrollHeight}px`;
        }
        // Native overflow on the sticky band and its real ancestors owns frozen
        // clipping. In particular, never chase scrollLeft with a root clip-path.
        layer.root.style.clipPath = "";
        if (!input.band || !layer.stickyBand) {
            layer.root.style.display = "none";
            layer.fillLayer.replaceChildren();
            layer.ringLayer.replaceChildren();
            return;
        }
        layer.stickyBand.style.left = `${input.band.left}px`;
        layer.stickyBand.style.width = `${input.band.width}px`;
        const clippedSelectionRects = input.selectionRects
            .map((rect) => clipOverlayRect(rect, input.clip))
            .filter((rect) => rect !== null);
        const clippedCopiedRects = input.copiedRects
            .map((rect) => clipOverlayRect(rect, input.clip))
            .filter((rect) => rect !== null);
        const clippedDragRect = input.dragRect ? clipOverlayRect(input.dragRect, input.clip) : null;
        const fillRects = clippedSelectionRects.map((rect) => createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill));
        if (clippedDragRect) {
            const dragFill = document.createElement("div");
            setRectStyles(dragFill, clippedDragRect);
            dragFill.style.background = this.theme.selectionFill;
            applyOverlayRadius(dragFill, clippedDragRect.radius);
            fillRects.push(dragFill);
        }
        const copiedRings = clippedCopiedRects.map((rect) => createCopiedRing(rect, this.theme.copiedOutline, this.theme.copiedOutlineWidth));
        layer.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
        layer.fillLayer.replaceChildren(...fillRects);
        layer.ringLayer.replaceChildren(...copiedRings);
    }
    /**
     * Removes both overlay roots from the document and restores the host position.
     */
    destroy() {
        this.base.root.remove();
        this.frozen.root.remove();
        if (this.previousHostPosition !== null) {
            this.host.style.position = this.previousHostPosition;
            this.previousHostPosition = null;
        }
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
 * Marks every logical coordinate covered by one table cell and its spans.
 */
function occupyGridSlots(grid, rowIndex, columnIndex, rowSpan, colSpan, onCoordinate) {
    let maxColumnCount = 0;
    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const aliasRowIndex = rowIndex + rowOffset;
        const gridRow = ensureGridRow(grid, aliasRowIndex);
        for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
            const aliasColumnIndex = columnIndex + columnOffset;
            gridRow[aliasColumnIndex] = true;
            onCoordinate?.(aliasRowIndex, aliasColumnIndex, rowOffset, columnOffset);
            maxColumnCount = Math.max(maxColumnCount, aliasColumnIndex + 1);
        }
    }
    return maxColumnCount;
}
/**
 * Registers every logical coordinate covered by one DOM cell and its spans.
 */
function registerCellAliases(cell, grid, rowSpan, colSpan, copyValue, cellByCoordinate, copyValueByCoordinate) {
    return occupyGridSlots(grid, cell.rowIndex, cell.columnIndex, rowSpan, colSpan, (aliasRowIndex, aliasColumnIndex, rowOffset, columnOffset) => {
        const alias = {
            rowId: getRowId(aliasRowIndex),
            columnId: getColumnId(aliasColumnIndex),
        };
        const coordinateKey = getCoordinateKey(alias.rowId, alias.columnId);
        cell.aliases.push(alias);
        cellByCoordinate.set(coordinateKey, cell);
        copyValueByCoordinate.set(coordinateKey, rowOffset === 0 && columnOffset === 0 ? copyValue : "");
    });
}
/**
 * Resolves the row elements included in the logical selection model.
 */
function getScopedRowElements(table, selectionScope) {
    if (selectionScope === "tbody") {
        return Array.from(table.tBodies).flatMap((section) => Array.from(section.rows));
    }
    return Array.from(table.rows);
}
/**
 * Builds a stable map key for one logical table coordinate.
 */
function getCoordinateKey(rowId, columnId) {
    return `${rowId}:${columnId}`;
}
/**
 * Resolves a computed-style reader, guarding SSR / no-window environments.
 */
function getComputeStyle() {
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
        return window.getComputedStyle.bind(window);
    }
    if (typeof globalThis.getComputedStyle === "function") {
        return globalThis.getComputedStyle.bind(globalThis);
    }
    return null;
}
/**
 * Detects whether a rendered cell is a left-pinned (frozen) sticky cell.
 *
 * Scope is intentionally left-pin only: a right-pinned column computes
 * `left: auto`, so it is treated as scrolling and the overlay degrades to its
 * single-layer behavior.
 */
function isLeftPinnedCell(element, computeStyle) {
    const style = computeStyle(element);
    if (!style) {
        return false;
    }
    const position = style.position;
    const left = style.left;
    return position === "sticky" && !!left && left !== "auto";
}
/**
 * Derives the set of frozen (left-pinned) column ids from the rendered cells.
 */
function detectFrozenColumnIds(cells) {
    const frozenColumnIds = new Set();
    const computeStyle = getComputeStyle();
    if (!computeStyle) {
        return frozenColumnIds;
    }
    cells.forEach((cell) => {
        if (isLeftPinnedCell(cell.element, computeStyle)) {
            cell.aliases.forEach((alias) => frozenColumnIds.add(alias.columnId));
        }
    });
    return frozenColumnIds;
}
/**
 * Builds a logical table model from the current DOM table structure.
 */
function buildDOMTableModel(table, options = {}) {
    const getCellText = options.getCellText ?? defaultGetCellText;
    const selectionScope = options.selectionScope ?? "all";
    const isSelectableCell = options.isSelectableCell ?? (() => true);
    const rowElements = getScopedRowElements(table, selectionScope);
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
            if (!isSelectableCell(cellElement)) {
                maxColumnCount = Math.max(maxColumnCount, occupyGridSlots(grid, rowIndex, columnIndex, rowSpan, colSpan));
                searchColumnIndex = columnIndex + colSpan;
                return;
            }
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
    const frozenColumnIds = detectFrozenColumnIds(cells);
    const columns = Array.from({ length: maxColumnCount }, (_, index) => {
        const id = getColumnId(index);
        return frozenColumnIds.has(id) ? { id, frozen: true } : { id };
    });
    return {
        rows,
        columns,
        cells,
        cellByCoordinate,
        copyValueByCoordinate,
        frozenColumnIds,
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
    "[data-table-steroids-ignore]",
].join(",");
const DEFAULT_DRAG_ACTIVATION_THRESHOLD = 5;
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
 * Measures how far a pending pointer press has moved from its origin.
 */
function getPointerMovementDistance(startClientX, startClientY, currentClientX, currentClientY) {
    return Math.hypot(currentClientX - startClientX, currentClientY - startClientY);
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
 * Creates deep copies of a selection bounds list.
 */
function cloneSelectionBoundsList(bounds) {
    return bounds.map((selectionBounds) => ({ ...selectionBounds }));
}
/**
 * Creates a shallow clone of one DOM table cell descriptor.
 */
function cloneDOMTableCell(cell) {
    return {
        ...cell,
        aliases: cell.aliases.map((alias) => ({ ...alias })),
    };
}
/**
 * Resolves the current numeric bounds for a selection list.
 */
function getSelectionBoundsList(selections, rowIndexMap, columnIndexMap) {
    return selections
        .map((selection) => getSelectionBounds(selection, rowIndexMap, columnIndexMap))
        .filter((selectionBounds) => selectionBounds !== null);
}
/**
 * Resolves the rendered DOM cells covered by a selection bounds list.
 */
function getSelectedDOMTableCells(boundsList, model, rowIndexMap, columnIndexMap) {
    const selectedCells = new Map();
    boundsList.forEach((selectionBounds) => {
        model.cells.forEach((cell) => {
            if (cellIntersectsSelectionBounds(cell, selectionBounds, rowIndexMap, columnIndexMap)) {
                selectedCells.set(cell.id, cell);
            }
        });
    });
    return Array.from(selectedCells.values());
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
function getMeasuredCellEdges(cell, overlayHost = null) {
    const cellRect = cell.getBoundingClientRect();
    const rowRect = cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.getBoundingClientRect() : null;
    const rootRect = overlayHost?.getBoundingClientRect() ?? null;
    const scrollLeft = overlayHost?.scrollLeft ?? 0;
    const scrollTop = overlayHost?.scrollTop ?? 0;
    const viewportLeftOffset = rootRect ? rootRect.left - scrollLeft : 0;
    const viewportTopOffset = rootRect ? rootRect.top - scrollTop : 0;
    return {
        left: Math.floor(cellRect.left - viewportLeftOffset),
        top: Math.floor(Math.min(cellRect.top, rowRect?.top ?? cellRect.top) - viewportTopOffset),
        right: Math.ceil(cellRect.right - viewportLeftOffset),
        bottom: Math.ceil(Math.max(cellRect.bottom, rowRect?.bottom ?? cellRect.bottom) - viewportTopOffset),
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
 * Reads the rounded corners from the table (or its nearest rounded ancestor) so the
 * selection highlight can match a rounded container edge. Returns null when nothing is rounded.
 */
function readSelectionCornerRadii(table, overlayHost) {
    const computeStyle = typeof window.getComputedStyle === "function"
        ? window.getComputedStyle.bind(window)
        : typeof globalThis.getComputedStyle === "function"
            ? globalThis.getComputedStyle.bind(globalThis)
            : null;
    if (!computeStyle) {
        return null;
    }
    let element = table;
    for (let depth = 0; element && depth < 6; depth += 1) {
        const style = computeStyle(element);
        const radius = {
            tl: style.borderTopLeftRadius || "0",
            tr: style.borderTopRightRadius || "0",
            br: style.borderBottomRightRadius || "0",
            bl: style.borderBottomLeftRadius || "0",
        };
        if ([radius.tl, radius.tr, radius.br, radius.bl].some((value) => Number.parseFloat(value) > 0)) {
            return radius;
        }
        if (element === overlayHost) {
            break;
        }
        element = element.parentElement;
    }
    return null;
}
/**
 * Unions the painted pixel edges of a group of cells into one rectangle.
 */
function measureGroup(cells, overlayHost) {
    if (cells.length === 0) {
        return null;
    }
    return cells.reduce((edges, cell) => {
        const measuredEdges = getMeasuredCellEdges(cell.element, overlayHost);
        return {
            left: Math.min(edges.left, measuredEdges.left),
            top: Math.min(edges.top, measuredEdges.top),
            right: Math.max(edges.right, measuredEdges.right),
            bottom: Math.max(edges.bottom, measuredEdges.bottom),
        };
    }, getMeasuredCellEdges(cells[0].element, overlayHost));
}
/**
 * Unions only the painted viewport X edges of a group of cells.
 */
function measureViewportX(cells) {
    if (cells.length === 0) {
        return null;
    }
    return cells.reduce((edges, cell) => {
        const rect = cell.element.getBoundingClientRect();
        return {
            left: Math.min(edges.left, Math.floor(rect.left)),
            right: Math.max(edges.right, Math.ceil(rect.right)),
        };
    }, {
        left: Math.floor(cells[0].element.getBoundingClientRect().left),
        right: Math.ceil(cells[0].element.getBoundingClientRect().right),
    });
}
/**
 * Resolves the rounded corners for one selection piece.
 *
 * `suppressLeft` / `suppressRight` force the corners on an interior seam edge to
 * square off so a boundary-spanning selection keeps its true outer corners while
 * the frozen/scrolling pieces meet flush at the freeze line.
 */
function resolveOverlayRadius(bounds, model, cornerRadii, suppressLeft, suppressRight) {
    if (!cornerRadii) {
        return undefined;
    }
    const atTop = bounds.minRow === 0;
    const atBottom = bounds.maxRow === model.rows.length - 1;
    const atLeft = bounds.minColumn === 0;
    const atRight = bounds.maxColumn === model.columns.length - 1;
    const resolved = {
        tl: atTop && atLeft && !suppressLeft ? cornerRadii.tl : "0",
        tr: atTop && atRight && !suppressRight ? cornerRadii.tr : "0",
        br: atBottom && atRight && !suppressRight ? cornerRadii.br : "0",
        bl: atBottom && atLeft && !suppressLeft ? cornerRadii.bl : "0",
    };
    if (resolved.tl !== "0" || resolved.tr !== "0" || resolved.br !== "0" || resolved.bl !== "0") {
        return resolved;
    }
    return undefined;
}
/**
 * Checks whether a rendered cell belongs to a frozen (left-pinned) column.
 */
function cellIsFrozen(cell, model) {
    return cell.aliases.some((alias) => model.frozenColumnIds.has(alias.columnId));
}
/**
 * Measures the on-screen rectangles covered by a logical selection, split at the
 * freeze boundary into a pinned (`frozen`) piece and a scrolling piece.
 *
 * When no columns are frozen every cell falls into the scrolling piece with no
 * stroke override, reproducing the historical single-rectangle output. When a
 * selection spans the boundary, the interior seam edges are suppressed
 * (`stroke.right = false` on the frozen piece, `stroke.left = false` on the
 * scrolling piece) so the two pieces read as one continuous highlight.
 */
function getOverlayRects(selection, model, rowIndexMap, columnIndexMap, overlayHost = null, cornerRadii = null, frozenBand = null) {
    const empty = { frozen: null, scrolling: null };
    const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
    if (!bounds) {
        return empty;
    }
    const selectedCells = model.cells.filter((cell) => cellIntersectsSelectionBounds(cell, bounds, rowIndexMap, columnIndexMap));
    if (selectedCells.length === 0) {
        return empty;
    }
    const frozenCells = selectedCells.filter((cell) => cellIsFrozen(cell, model));
    const scrollingCells = selectedCells.filter((cell) => !cellIsFrozen(cell, model));
    const spansBoundary = frozenCells.length > 0 && scrollingCells.length > 0;
    const buildRect = (cells, suppressLeft, suppressRight, useFrozenBand) => {
        const edges = measureGroup(cells, overlayHost);
        if (!edges) {
            return null;
        }
        const width = edges.right - edges.left;
        const height = edges.bottom - edges.top;
        if (width <= 0 || height <= 0) {
            return null;
        }
        const stroke = spansBoundary
            ? { top: true, right: !suppressRight, bottom: true, left: !suppressLeft }
            : undefined;
        const viewportX = useFrozenBand ? measureViewportX(cells) : null;
        if (useFrozenBand && (!frozenBand || !viewportX)) {
            return null;
        }
        return {
            // Frozen X is stable and local to the native sticky surface. Vertical
            // geometry deliberately remains in the existing content coordinate space.
            left: useFrozenBand && viewportX && frozenBand ? viewportX.left - frozenBand.viewportLeft : edges.left,
            top: edges.top,
            width: useFrozenBand && viewportX ? viewportX.right - viewportX.left : width,
            height,
            radius: resolveOverlayRadius(bounds, model, cornerRadii, suppressLeft, suppressRight),
            stroke,
        };
    };
    return {
        frozen: frozenCells.length > 0 ? buildRect(frozenCells, false, spansBoundary, true) : null,
        scrolling: scrollingCells.length > 0 ? buildRect(scrollingCells, spansBoundary, false, false) : null,
    };
}
/**
 * Checks whether an overflow value establishes the scrollport used by sticky X.
 */
function isStickyScrollOverflowValue(value) {
    return value === "auto" || value === "scroll" || value === "hidden" || value === "overlay";
}
/**
 * Finds the viewport edge that CSS uses for the frozen band's sticky inset.
 * `overflow: clip` intentionally does not establish a sticky scrollport.
 */
function getStickyScrollportLeft(overlayHost) {
    let ancestor = overlayHost;
    while (ancestor) {
        const { overflowX } = getElementOverflowStyles(ancestor);
        if (isStickyScrollOverflowValue(overflowX)) {
            return ancestor.getBoundingClientRect().left;
        }
        ancestor = ancestor.parentElement;
    }
    return 0;
}
/**
 * Measures the frozen cells' painted band once and converts its left edge to the
 * inset understood by the native sticky surface.
 */
function getFrozenBandGeometry(model, overlayHost) {
    const frozenCells = model.cells.filter((cell) => cellIsFrozen(cell, model));
    const viewportX = measureViewportX(frozenCells);
    if (!viewportX) {
        return null;
    }
    return {
        left: viewportX.left - getStickyScrollportLeft(overlayHost),
        width: viewportX.right - viewportX.left,
        viewportLeft: viewportX.left,
        viewportRight: viewportX.right,
    };
}
/**
 * Converts a viewport X edge to the base layer's existing coordinate space.
 */
function viewportXToOverlayContent(value, overlayHost) {
    if (!overlayHost) {
        return value;
    }
    return value - overlayHost.getBoundingClientRect().left + overlayHost.scrollLeft;
}
/**
 * Checks whether an overflow value creates a clipping boundary for descendants.
 */
function isClippingOverflowValue(value) {
    return value === "auto" || value === "scroll" || value === "hidden" || value === "clip";
}
/**
 * Resolves the overflow styles that can clip a table in the host app.
 */
function getElementOverflowStyles(element) {
    const computedStyle = typeof window.getComputedStyle === "function"
        ? window.getComputedStyle(element)
        : typeof globalThis.getComputedStyle === "function"
            ? globalThis.getComputedStyle(element)
            : null;
    return {
        overflowX: computedStyle?.overflowX || element.style.overflowX || element.style.overflow || "",
        overflowY: computedStyle?.overflowY || element.style.overflowY || element.style.overflow || "",
    };
}
/**
 * Intersects two viewport-positioned clipping rectangles.
 */
function intersectClipRects(first, second) {
    const nextClipRect = {
        top: Math.max(first.top, second.top),
        right: Math.min(first.right, second.right),
        bottom: Math.min(first.bottom, second.bottom),
        left: Math.max(first.left, second.left),
    };
    if (nextClipRect.right <= nextClipRect.left || nextClipRect.bottom <= nextClipRect.top) {
        return null;
    }
    return nextClipRect;
}
/**
 * Finds the nearest ancestor whose overflow clips the table; mounting there makes the overlay follow elastic scroll.
 */
function getOverlayHost(table) {
    let ancestor = table.parentElement;
    while (ancestor) {
        const { overflowX, overflowY } = getElementOverflowStyles(ancestor);
        if (isClippingOverflowValue(overflowX) || isClippingOverflowValue(overflowY)) {
            return ancestor;
        }
        ancestor = ancestor.parentElement;
    }
    return null;
}
/**
 * Converts one viewport rect into the local coordinate space of the overlay host's scrollable content.
 */
function getLocalClipRect(rect, overlayHost) {
    const hostRect = overlayHost.getBoundingClientRect();
    const leftOffset = hostRect.left - overlayHost.scrollLeft;
    const topOffset = hostRect.top - overlayHost.scrollTop;
    return {
        top: rect.top - topOffset,
        right: rect.right - leftOffset,
        bottom: rect.bottom - topOffset,
        left: rect.left - leftOffset,
    };
}
/**
 * Computes the viewport area where table-steroids overlay geometry is allowed to paint.
 */
function getOverlayClipRect(table, overlayHost = null) {
    const tableRect = table.getBoundingClientRect();
    const hostRect = overlayHost?.getBoundingClientRect() ?? null;
    const viewportClipRect = {
        top: overlayHost?.scrollTop ?? 0,
        right: overlayHost
            ? overlayHost.scrollLeft + (overlayHost.clientWidth || hostRect?.width || 0)
            : typeof window.innerWidth === "number"
                ? window.innerWidth
                : Number.POSITIVE_INFINITY,
        bottom: overlayHost
            ? overlayHost.scrollTop + (overlayHost.clientHeight || hostRect?.height || 0)
            : typeof window.innerHeight === "number"
                ? window.innerHeight
                : Number.POSITIVE_INFINITY,
        left: overlayHost?.scrollLeft ?? 0,
    };
    const tableClipRect = overlayHost
        ? getLocalClipRect(tableRect, overlayHost)
        : {
            top: tableRect.top,
            right: tableRect.right,
            bottom: tableRect.bottom,
            left: tableRect.left,
        };
    let clipRect = intersectClipRects(viewportClipRect, tableClipRect);
    if (!clipRect) {
        return null;
    }
    let ancestor = table.parentElement;
    while (ancestor) {
        const { overflowX, overflowY } = getElementOverflowStyles(ancestor);
        if (isClippingOverflowValue(overflowX) || isClippingOverflowValue(overflowY)) {
            const ancestorRect = ancestor.getBoundingClientRect();
            clipRect = intersectClipRects(clipRect, overlayHost
                ? getLocalClipRect(ancestorRect, overlayHost)
                : {
                    top: ancestorRect.top,
                    right: ancestorRect.right,
                    bottom: ancestorRect.bottom,
                    left: ancestorRect.left,
                });
            if (!clipRect) {
                return null;
            }
        }
        if (ancestor === overlayHost) {
            break;
        }
        ancestor = ancestor.parentElement;
    }
    return clipRect;
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
    const activationMode = options.activationMode ?? "pointerdown";
    const observeMutations = options.observeMutations ?? true;
    const plugins = options.plugins ?? [];
    const overlayHost = getOverlayHost(table);
    const overlay = new SelectionOverlay(options.overlay, overlayHost ?? undefined);
    const managedCells = new Map();
    const cellByElement = new WeakMap();
    const modelBuildOptions = {
        getCellText: options.getCellText,
        selectionScope: options.selectionScope,
        isSelectableCell: options.isSelectableCell,
    };
    let model = buildDOMTableModel(table, modelBuildOptions);
    let rowIndexMap = buildIndexMap(model.rows);
    let columnIndexMap = buildIndexMap(model.columns);
    let selectionRanges = [];
    let activeSelection = null;
    let copiedSelectionKeys = [];
    let selectedCell = null;
    let rangeAnchorCell = null;
    let pendingPressState = null;
    let dragState = null;
    let frameId = null;
    let bodyUserSelectValue = null;
    const previousTouchAction = table.style.touchAction;
    let handle;
    ensureManagedCellStyles();
    table.setAttribute(MANAGED_TABLE_ATTRIBUTE, "true");
    if (interactionMode === "touch") {
        table.style.touchAction = "none";
    }
    /**
     * Emits the current selection state through the external callback.
     */
    const emitSelectionChange = () => {
        const selections = cloneSelections(selectionRanges);
        const nextActiveSelection = activeSelection ? cloneSelection(activeSelection) : null;
        options.onSelectionChange?.(selections, nextActiveSelection);
        if (plugins.length === 0) {
            return;
        }
        const snapshot = getSelectionSnapshot();
        plugins.forEach((plugin) => {
            plugin.onSelectionChange?.(snapshot, pluginContext);
        });
    };
    /**
     * Returns a snapshot of the current selection state and rendered cells.
     */
    const getSelectionSnapshot = () => {
        const bounds = cloneSelectionBoundsList(getSelectionBoundsList(selectionRanges, rowIndexMap, columnIndexMap));
        const selectedCells = getSelectedDOMTableCells(bounds, model, rowIndexMap, columnIndexMap).map(cloneDOMTableCell);
        return {
            selections: cloneSelections(selectionRanges),
            activeSelection: activeSelection ? cloneSelection(activeSelection) : null,
            bounds,
            selectedCells,
        };
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
     * Checks whether one managed interaction should be ignored.
     */
    const shouldIgnoreManagedEvent = (event, cell, phase) => {
        if ((cell && shouldIgnoreTarget(event.target, cell.element)) ||
            (!cell && isElement(event.target) && event.target.closest(IGNORE_INTERACTIVE_SELECTOR))) {
            return true;
        }
        return options.shouldIgnoreEvent?.({ event, cell, phase }) ?? false;
    };
    const pluginContext = {
        table,
        get handle() {
            return handle;
        },
        getSnapshot: () => getSelectionSnapshot(),
        refresh: () => handle.refresh(),
        clearSelection: () => handle.clearSelection(),
        setSelections: (selections, nextActiveSelection) => handle.setSelections(selections, nextActiveSelection),
        copySelection: () => handle.copySelection(),
    };
    /**
     * Gives installed plugins a chance to handle a focused table keydown first.
     */
    const dispatchKeyDownPlugins = (event) => {
        if (plugins.length === 0) {
            return false;
        }
        const snapshot = getSelectionSnapshot();
        for (const plugin of plugins) {
            if (plugin.onKeyDown?.(event, snapshot, pluginContext) === "handled") {
                return true;
            }
        }
        return false;
    };
    /**
     * Applies a pointer-driven selection and returns the cell that should receive focus.
     */
    const commitPointerSelection = (selection, mode, baseSelections) => {
        let focusTarget = selection.end;
        applySelection(selection, mode, baseSelections);
        if (mode === "subtract") {
            selectedCell = activeSelection?.end ?? null;
            rangeAnchorCell = selectedCell;
            if (selectedCell) {
                focusTarget = selectedCell;
            }
        }
        else {
            selectedCell = selection.end;
            rangeAnchorCell = selection.start;
        }
        return focusTarget;
    };
    /**
     * Clears any pending desktop press before it becomes a drag or click selection.
     */
    const clearPendingPress = () => {
        pendingPressState = null;
    };
    /**
     * Promotes a pending desktop press into an active drag interaction.
     */
    const promotePendingPressToDrag = (event) => {
        if (!pendingPressState || pendingPressState.pointerId !== event.pointerId || !allowRangeSelection) {
            return false;
        }
        if (getPointerMovementDistance(pendingPressState.clientX, pendingPressState.clientY, event.clientX, event.clientY) < DEFAULT_DRAG_ACTIVATION_THRESHOLD) {
            return false;
        }
        startDragSelection(pendingPressState.pointerId, pendingPressState.pointerType, pendingPressState.selection, pendingPressState.anchor, pendingPressState.mode, pendingPressState.baseSelections);
        event.preventDefault();
        table.setPointerCapture?.(event.pointerId);
        clearPendingPress();
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
        const cornerRadii = readSelectionCornerRadii(table, overlayHost);
        const frozenBand = getFrozenBandGeometry(model, overlayHost);
        const baseSelectionRects = [];
        const frozenSelectionRects = [];
        selectionRanges.forEach((selection) => {
            const { frozen, scrolling } = getOverlayRects(selection, model, rowIndexMap, columnIndexMap, overlayHost, cornerRadii, frozenBand);
            const key = getSelectionKey(selection);
            if (scrolling) {
                baseSelectionRects.push({ key, ...scrolling });
            }
            if (frozen) {
                frozenSelectionRects.push({ key, ...frozen });
            }
        });
        const baseCopiedRects = baseSelectionRects.filter((rect) => copiedSelectionKeys.includes(rect.key));
        const frozenCopiedRects = frozenSelectionRects.filter((rect) => copiedSelectionKeys.includes(rect.key));
        let baseDragRect = null;
        let frozenDragRect = null;
        if (dragState) {
            const { frozen, scrolling } = getOverlayRects(dragState.selection, model, rowIndexMap, columnIndexMap, overlayHost, cornerRadii, frozenBand);
            if (scrolling) {
                baseDragRect = { key: "drag-selection", ...scrolling };
            }
            if (frozen) {
                frozenDragRect = { key: "drag-selection", ...frozen };
            }
        }
        const baseClip = getOverlayClipRect(table, overlayHost);
        const bandRight = frozenBand ? viewportXToOverlayContent(frozenBand.viewportRight, overlayHost) : null;
        // The scrolling layer paints right of the band; the pinned layer paints left
        // of it. With no frozen columns bandRight is null and the scrolling clip is
        // exactly the historical clip, keeping the single-layer output unchanged.
        const scrollClip = baseClip && bandRight !== null ? { ...baseClip, left: Math.max(baseClip.left, bandRight) } : baseClip;
        const frozenClip = baseClip && frozenBand
            ? { top: baseClip.top, right: frozenBand.width, bottom: baseClip.bottom, left: 0 }
            : null;
        const base = {
            selectionRects: baseSelectionRects,
            copiedRects: baseCopiedRects,
            dragRect: baseDragRect,
            clip: scrollClip,
        };
        const frozenLayer = {
            selectionRects: frozenSelectionRects,
            copiedRects: frozenCopiedRects,
            dragRect: frozenDragRect,
            clip: frozenClip,
        };
        overlay.render({ base, frozen: { ...frozenLayer, band: frozenBand } });
    };
    /**
     * Schedules one overlay render on the next animation frame.
     */
    const scheduleOverlayRender = () => {
        if (frameId !== null) {
            return;
        }
        let didRunSynchronously = false;
        const nextFrameId = window.requestAnimationFrame(() => {
            didRunSynchronously = true;
            frameId = null;
            renderOverlay();
        });
        if (!didRunSynchronously) {
            frameId = nextFrameId;
        }
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
        model = buildDOMTableModel(table, modelBuildOptions);
        rowIndexMap = buildIndexMap(model.rows);
        columnIndexMap = buildIndexMap(model.columns);
        syncFocusableCells(model);
        clearPendingPress();
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
        if (!cell || shouldIgnoreManagedEvent(event, cell, "keydown")) {
            return;
        }
        if (dispatchKeyDownPlugins(event)) {
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
        if (!cell || shouldIgnoreManagedEvent(event, cell, "pointerdown")) {
            return;
        }
        const nextCell = getCellCoordinates(cell);
        const rangeAnchor = rangeAnchorCell ?? selectedCell ?? activeSelection?.end;
        const nextSelection = createSelection(nextCell, nextCell);
        const allowsDesktopMultiSelect = interactionMode === "desktop";
        const isToggleSelection = allowsDesktopMultiSelect && (event.metaKey || event.ctrlKey);
        const isRangeExtension = allowRangeSelection && allowsDesktopMultiSelect && event.shiftKey && rangeAnchor && !isToggleSelection;
        const usesPendingDesktopPress = interactionMode === "desktop" && event.pointerType !== "touch";
        clearPendingPress();
        if (isRangeExtension && rangeAnchor) {
            const rangeSelection = createSelection(rangeAnchor, nextCell);
            if (usesPendingDesktopPress) {
                const selectionCommitted = activationMode === "pointerdown";
                if (selectionCommitted) {
                    commitPointerSelection(rangeSelection, "replace", []);
                }
                pendingPressState = {
                    pointerId: event.pointerId,
                    pointerType: event.pointerType,
                    anchor: rangeAnchor,
                    selection: rangeSelection,
                    mode: "replace",
                    baseSelections: [],
                    clientX: event.clientX,
                    clientY: event.clientY,
                    selectionCommitted,
                };
                return;
            }
            event.preventDefault();
            selectedCell = nextCell;
            rangeAnchorCell = rangeAnchor;
            startDragSelection(event.pointerId, event.pointerType, rangeSelection, rangeAnchor, "replace", []);
            table.setPointerCapture?.(event.pointerId);
            return;
        }
        const mode = isToggleSelection
            ? isCellSelected(nextCell.rowId, nextCell.columnId, selectionRanges, rowIndexMap, columnIndexMap)
                ? "subtract"
                : "add"
            : "replace";
        const baseSelections = selectionRanges;
        if (usesPendingDesktopPress) {
            const selectionCommitted = activationMode === "pointerdown";
            if (selectionCommitted) {
                commitPointerSelection(nextSelection, mode, baseSelections);
            }
            pendingPressState = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                anchor: nextCell,
                selection: nextSelection,
                mode,
                baseSelections,
                clientX: event.clientX,
                clientY: event.clientY,
                selectionCommitted,
            };
            return;
        }
        event.preventDefault();
        selectedCell = nextCell;
        rangeAnchorCell = nextCell;
        startDragSelection(event.pointerId, event.pointerType, nextSelection, nextCell, mode, baseSelections);
        table.setPointerCapture?.(event.pointerId);
    };
    /**
     * Updates the in-progress selection while a pointer drag is active.
     */
    const handleTablePointerMove = (event) => {
        if (pendingPressState && pendingPressState.pointerId === event.pointerId) {
            if (!promotePendingPressToDrag(event)) {
                return;
            }
        }
        if (!dragState || dragState.pointerId !== event.pointerId || !allowRangeSelection) {
            return;
        }
        const cell = getCellFromPoint(event.clientX, event.clientY, table, cellByElement) ?? getEventCell(event.target, table, cellByElement);
        if (!cell || shouldIgnoreManagedEvent(event, cell, "pointermove")) {
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
        const focusTarget = commitPointerSelection(dragState.selection, dragState.mode, dragState.baseSelections);
        if (interactionMode === "desktop" && focusTarget) {
            focusCell(focusTarget.rowId, focusTarget.columnId);
        }
        stopDragSelection();
    };
    /**
     * Commits any active pointer selection when the interaction ends.
     */
    const handleTablePointerUp = (event) => {
        if (pendingPressState && pendingPressState.pointerId === event.pointerId) {
            const nextPendingPressState = pendingPressState;
            const focusTarget = nextPendingPressState.selectionCommitted
                ? selectedCell ?? nextPendingPressState.selection.end
                : commitPointerSelection(nextPendingPressState.selection, nextPendingPressState.mode, nextPendingPressState.baseSelections);
            clearPendingPress();
            if (interactionMode === "desktop" && focusTarget) {
                focusCell(focusTarget.rowId, focusTarget.columnId);
            }
            return;
        }
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
        if (pendingPressState && pendingPressState.pointerId === event.pointerId) {
            clearPendingPress();
            return;
        }
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
        const cell = getEventCell(event.target, table, cellByElement);
        if (shouldIgnoreManagedEvent(event, cell, "copy")) {
            return;
        }
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") {
            return;
        }
        if (dispatchKeyDownPlugins(event)) {
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
    handle = {
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
            pluginCleanups.slice().reverse().forEach((cleanup) => cleanup());
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
         * Replaces the current selections with a caller-provided selection set.
         */
        setSelections(selections, nextActiveSelection) {
            clearPendingPress();
            stopDragSelection(false);
            syncSelections(selections, nextActiveSelection === undefined ? getLastSelection(selections) : nextActiveSelection);
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
         * Returns a snapshot of the current selection state and selected DOM cells.
         */
        getSelectionSnapshot() {
            return getSelectionSnapshot();
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
    const pluginCleanups = plugins
        .map((plugin) => plugin.onSetup?.(pluginContext))
        .filter((cleanup) => typeof cleanup === "function");
    emitSelectionChange();
    scheduleOverlayRender();
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
