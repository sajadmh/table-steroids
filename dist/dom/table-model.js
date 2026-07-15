/**
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
export function getCoordinateKey(rowId, columnId) {
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
export function buildDOMTableModel(table, options = {}) {
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
//# sourceMappingURL=table-model.js.map