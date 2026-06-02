import { copySelectionToText, resolveCopySelection } from "../core/copy-plan.js";
import { buildIndexMap, getSelectionBounds, getSelectionKey, isCellSelected, normalizeSelections, resolveActiveSelection, subtractSelection, } from "../core/geometry.js";
import { restoreSelectionState, snapshotSelectionState } from "../core/persistence.js";
import { copyTextToClipboard } from "./clipboard.js";
import { resolveSelectionFocusState } from "./focus-state.js";
import { resolveInteractionMode, } from "./interaction-mode.js";
import { SelectionOverlay, } from "./overlay.js";
import { buildDOMTableModel, getCoordinateKey, } from "./table-model.js";
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
 * Measures the on-screen rectangle covered by a logical selection.
 */
function getOverlayRect(selection, model, rowIndexMap, columnIndexMap, overlayHost = null, cornerRadii = null) {
    const bounds = getSelectionBounds(selection, rowIndexMap, columnIndexMap);
    if (!bounds) {
        return null;
    }
    const selectedCells = model.cells.filter((cell) => cellIntersectsSelectionBounds(cell, bounds, rowIndexMap, columnIndexMap));
    if (selectedCells.length === 0) {
        return null;
    }
    const selectionEdges = selectedCells.reduce((edges, cell) => {
        const measuredEdges = getMeasuredCellEdges(cell.element, overlayHost);
        return {
            left: Math.min(edges.left, measuredEdges.left),
            top: Math.min(edges.top, measuredEdges.top),
            right: Math.max(edges.right, measuredEdges.right),
            bottom: Math.max(edges.bottom, measuredEdges.bottom),
        };
    }, getMeasuredCellEdges(selectedCells[0].element, overlayHost));
    const width = selectionEdges.right - selectionEdges.left;
    const height = selectionEdges.bottom - selectionEdges.top;
    if (width <= 0 || height <= 0) {
        return null;
    }
    let radius;
    if (cornerRadii) {
        const atTop = bounds.minRow === 0;
        const atBottom = bounds.maxRow === model.rows.length - 1;
        const atLeft = bounds.minColumn === 0;
        const atRight = bounds.maxColumn === model.columns.length - 1;
        const resolved = {
            tl: atTop && atLeft ? cornerRadii.tl : "0",
            tr: atTop && atRight ? cornerRadii.tr : "0",
            br: atBottom && atRight ? cornerRadii.br : "0",
            bl: atBottom && atLeft ? cornerRadii.bl : "0",
        };
        if (resolved.tl !== "0" || resolved.tr !== "0" || resolved.br !== "0" || resolved.bl !== "0") {
            radius = resolved;
        }
    }
    return {
        left: selectionEdges.left,
        top: selectionEdges.top,
        width,
        height,
        radius,
    };
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
export function enhanceTable(table, options = {}) {
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
        const selectionRects = selectionRanges
            .map((selection) => {
            const rect = getOverlayRect(selection, model, rowIndexMap, columnIndexMap, overlayHost, cornerRadii);
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
        const nextDragRect = dragState
            ? getOverlayRect(dragState.selection, model, rowIndexMap, columnIndexMap, overlayHost, cornerRadii)
            : null;
        const clipRect = getOverlayClipRect(table, overlayHost);
        overlay.render(selectionRects, copiedRects, nextDragRect ? { key: "drag-selection", ...nextDragRect } : null, clipRect);
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