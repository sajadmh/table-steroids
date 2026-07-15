import type { CellCoordinates, SelectableItem } from "../core/types.js";
export interface DOMTableCell {
    id: string;
    rowId: string;
    columnId: string;
    rowIndex: number;
    columnIndex: number;
    element: HTMLTableCellElement;
    aliases: CellCoordinates[];
}
export interface DOMTableModel {
    rows: SelectableItem[];
    columns: SelectableItem[];
    cells: DOMTableCell[];
    cellByCoordinate: Map<string, DOMTableCell>;
    copyValueByCoordinate: Map<string, string>;
    /**
     * Ids of the columns detected as frozen (left-pinned sticky) from the DOM.
     * Empty when nothing is frozen, keeping the selection overlay single-layer.
     */
    frozenColumnIds: Set<string>;
}
export type DOMTableSelectionScope = "all" | "tbody";
export interface BuildDOMTableModelOptions {
    getCellText?: (cell: HTMLTableCellElement) => string;
    selectionScope?: DOMTableSelectionScope;
    isSelectableCell?: (cell: HTMLTableCellElement) => boolean;
}
/**
 * Builds a stable map key for one logical table coordinate.
 */
export declare function getCoordinateKey(rowId: string, columnId: string): string;
/**
 * Builds a logical table model from the current DOM table structure.
 */
export declare function buildDOMTableModel(table: HTMLTableElement, options?: BuildDOMTableModelOptions): DOMTableModel;
//# sourceMappingURL=table-model.d.ts.map