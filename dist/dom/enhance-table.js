import { copySelectionToText, resolveCopySelection } from "../core/copy-plan.js";
import { buildIndexMap, getSelectionBounds, getSelectionKey, isCellSelected, normalizeSelections, resolveActiveSelection, subtractSelection, } from "../core/geometry.js";
import { restoreSelectionState, snapshotSelectionState } from "../core/persistence.js";
import { copyTextToClipboard } from "./clipboard.js";
import { resolveSelectionFocusState } from "./focus-state.js";
import { SelectionOverlay } from "./overlay.js";
import { buildDOMTableModel, getCoordinateKey } from "./table-model.js";
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
            clipboardCell.innerHTML = sourceCell.element.innerHTML;
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
export function enhanceTable(table, options = {}) {
    const enhancedTable = table;
    if (enhancedTable.__nativeSpreadsheetHandle__) {
        enhancedTable.__nativeSpreadsheetHandle__.refresh();
        return enhancedTable.__nativeSpreadsheetHandle__;
    }
    const allowCellSelection = options.allowCellSelection ?? true;
    const allowRangeSelection = options.allowRangeSelection ?? true;
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
    let lastDragMoved = false;
    let selectionHandledOnMouseDown = false;
    let frameId = null;
    let bodyUserSelectValue = null;
    ensureManagedCellStyles();
    table.setAttribute(MANAGED_TABLE_ATTRIBUTE, "true");
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
    const startDragSelection = (selection, anchor, mode, baseSelections) => {
        lastDragMoved = false;
        dragState = {
            anchor,
            selection,
            mode,
            baseSelections,
            moved: false,
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
            lastDragMoved = false;
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
        if (!allowCellSelection) {
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
     * Starts mouse-based selection or toggle-selection interactions.
     */
    const handleCellMouseDown = (event) => {
        if (!allowRangeSelection || event.button !== 0) {
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
        const isToggleSelection = event.metaKey || event.ctrlKey;
        if (event.shiftKey && rangeAnchor && !isToggleSelection) {
            selectedCell = nextCell;
            rangeAnchorCell = rangeAnchor;
            startDragSelection(createSelection(rangeAnchor, nextCell), rangeAnchor, "replace", []);
            return;
        }
        const mode = isToggleSelection
            ? isCellSelected(nextCell.rowId, nextCell.columnId, selectionRanges, rowIndexMap, columnIndexMap)
                ? "subtract"
                : "add"
            : "replace";
        selectedCell = nextCell;
        rangeAnchorCell = nextCell;
        startDragSelection(nextSelection, nextCell, mode, selectionRanges);
    };
    /**
     * Updates the in-progress drag selection as the pointer moves across cells.
     */
    const handleCellMouseOver = (event) => {
        if (!allowRangeSelection || !dragState) {
            return;
        }
        const cell = getEventCell(event.target, table, cellByElement);
        if (!cell) {
            return;
        }
        const coordinate = getCellCoordinates(cell);
        const coordinateKey = getCoordinateKey(coordinate.rowId, coordinate.columnId);
        if (coordinateKey === dragState.lastHoveredCoordinateKey) {
            return;
        }
        dragState = {
            ...dragState,
            selection: createSelection(dragState.anchor, coordinate),
            moved: dragState.moved || dragState.anchor.rowId !== coordinate.rowId || dragState.anchor.columnId !== coordinate.columnId,
            lastHoveredCoordinateKey: coordinateKey,
        };
        scheduleOverlayRender();
    };
    /**
     * Finalizes click-based selection behavior after mouse interaction completes.
     */
    const handleCellClick = (event) => {
        if (!allowCellSelection) {
            return;
        }
        const cell = getEventCell(event.target, table, cellByElement);
        if (!cell || shouldIgnoreTarget(event.target, cell.element)) {
            return;
        }
        const nextCell = getCellCoordinates(cell);
        const rangeAnchor = rangeAnchorCell ?? selectedCell ?? activeSelection?.end;
        const isToggleSelection = event.metaKey || event.ctrlKey;
        if (event.shiftKey && rangeAnchor && !isToggleSelection) {
            const nextSelection = createSelection(rangeAnchor, nextCell);
            selectionHandledOnMouseDown = false;
            lastDragMoved = false;
            selectedCell = nextCell;
            rangeAnchorCell = rangeAnchor;
            syncSelections([nextSelection], nextSelection);
            focusCell(nextCell.rowId, nextCell.columnId);
            return;
        }
        if (selectionHandledOnMouseDown) {
            selectionHandledOnMouseDown = false;
            if (!lastDragMoved) {
                focusCell(nextCell.rowId, nextCell.columnId);
            }
            lastDragMoved = false;
            return;
        }
        if (lastDragMoved) {
            lastDragMoved = false;
            return;
        }
        const nextSelection = createSelection(nextCell, nextCell);
        const isAlreadySelected = isCellSelected(nextCell.rowId, nextCell.columnId, selectionRanges, rowIndexMap, columnIndexMap);
        selectedCell = nextCell;
        rangeAnchorCell = nextCell;
        if (!isToggleSelection) {
            syncSelections([nextSelection], nextSelection);
            focusCell(nextCell.rowId, nextCell.columnId);
            return;
        }
        if (isAlreadySelected) {
            const nextSelections = subtractSelection(selectionRanges, nextSelection, model.rows, model.columns, rowIndexMap, columnIndexMap);
            syncSelections(nextSelections, getLastSelection(nextSelections));
            return;
        }
        const nextSelections = subtractSelection(selectionRanges, nextSelection, model.rows, model.columns, rowIndexMap, columnIndexMap);
        syncSelections([...nextSelections, nextSelection], nextSelection);
        focusCell(nextCell.rowId, nextCell.columnId);
    };
    /**
     * Commits any active drag selection when the mouse is released.
     */
    const handleDocumentMouseUp = () => {
        if (dragState) {
            const committedSelection = dragState.selection;
            let focusTarget = committedSelection.end;
            lastDragMoved = dragState.moved;
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
            focusCell(focusTarget.rowId, focusTarget.columnId);
            selectionHandledOnMouseDown = true;
        }
        else {
            lastDragMoved = false;
        }
        stopDragSelection();
    };
    /**
     * Handles document-level copy shortcuts while the table owns focus.
     */
    const handleDocumentKeyDown = async (event) => {
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
    table.addEventListener("mousedown", handleCellMouseDown);
    table.addEventListener("mouseover", handleCellMouseOver);
    table.addEventListener("click", handleCellClick);
    document.addEventListener("mouseup", handleDocumentMouseUp);
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
            table.removeEventListener("mousedown", handleCellMouseDown);
            table.removeEventListener("mouseover", handleCellMouseOver);
            table.removeEventListener("click", handleCellClick);
            document.removeEventListener("mouseup", handleDocumentMouseUp);
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
export function enhanceTables(root = document, options = {}) {
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
//# sourceMappingURL=enhance-table.js.map