import type { Selection } from "../core/types.js";
import { type ResolvedTableSpreadsheetInteractionMode, type TableSpreadsheetInteractionMode } from "./interaction-mode.js";
import { type SpreadsheetOverlayTheme } from "./overlay.js";
export interface TableSpreadsheetOptions {
    allowCellSelection?: boolean;
    allowRangeSelection?: boolean;
    interactionMode?: TableSpreadsheetInteractionMode;
    observeMutations?: boolean;
    onSelectionChange?: (selections: Selection[], activeSelection: Selection | null) => void;
    onSelectionCopy?: (text: string, selections: Selection[]) => void;
    getCellText?: (cell: HTMLTableCellElement) => string;
    overlay?: Partial<SpreadsheetOverlayTheme>;
}
export interface TableSpreadsheetHandle {
    destroy(): void;
    refresh(): void;
    clearSelection(): void;
    getSelections(): Selection[];
    getActiveSelection(): Selection | null;
    getInteractionMode(): ResolvedTableSpreadsheetInteractionMode;
    copySelection(): Promise<boolean>;
}
export interface TableSpreadsheetCollectionHandle {
    destroy(): void;
    refresh(): void;
    copySelection(): Promise<boolean>;
    handles: TableSpreadsheetHandle[];
}
export interface EnhanceTablesOptions extends TableSpreadsheetOptions {
    selector?: string;
}
/**
 * Enhances one table element with spreadsheet-style selection behavior.
 */
export declare function enhanceTable(table: HTMLTableElement, options?: TableSpreadsheetOptions): TableSpreadsheetHandle;
/**
 * Enhances every matching table under a root and returns a collection handle.
 */
export declare function enhanceTables(root?: ParentNode, options?: EnhanceTablesOptions): TableSpreadsheetCollectionHandle;
//# sourceMappingURL=enhance-table.d.ts.map