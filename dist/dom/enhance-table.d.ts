import type { Selection, SelectionBounds } from "../core/types.js";
import { type ResolvedTableSpreadsheetInteractionMode, type TableSpreadsheetInteractionMode } from "./interaction-mode.js";
import { type SpreadsheetOverlayTheme } from "./overlay.js";
import { type BuildDOMTableModelOptions, type DOMTableCell, type DOMTableSelectionScope } from "./table-model.js";
export type TableSpreadsheetActivationMode = "pointerdown" | "click";
export type TableSpreadsheetIgnorePhase = "copy" | "keydown" | "pointerdown" | "pointermove";
export interface TableSpreadsheetIgnoreContext {
    event: Event;
    cell: DOMTableCell | null;
    phase: TableSpreadsheetIgnorePhase;
}
export interface TableSpreadsheetOptions {
    allowCellSelection?: boolean;
    allowRangeSelection?: boolean;
    interactionMode?: TableSpreadsheetInteractionMode;
    activationMode?: TableSpreadsheetActivationMode;
    observeMutations?: boolean;
    onSelectionChange?: (selections: Selection[], activeSelection: Selection | null) => void;
    onSelectionCopy?: (text: string, selections: Selection[]) => void;
    getCellText?: (cell: HTMLTableCellElement) => string;
    selectionScope?: DOMTableSelectionScope;
    isSelectableCell?: BuildDOMTableModelOptions["isSelectableCell"];
    shouldIgnoreEvent?: (context: TableSpreadsheetIgnoreContext) => boolean;
    overlay?: Partial<SpreadsheetOverlayTheme>;
    plugins?: TableSpreadsheetPlugin[];
}
export interface TableSelectionSnapshot {
    selections: Selection[];
    activeSelection: Selection | null;
    bounds: SelectionBounds[];
    selectedCells: DOMTableCell[];
}
export interface TableSpreadsheetPluginContext {
    table: HTMLTableElement;
    handle: TableSpreadsheetHandle;
    getSnapshot(): TableSelectionSnapshot;
    refresh(): void;
    clearSelection(): void;
    setSelections(selections: Selection[], activeSelection?: Selection | null): void;
    copySelection(): Promise<boolean>;
}
export interface TableSpreadsheetPlugin {
    name: string;
    onSetup?: (context: TableSpreadsheetPluginContext) => void | (() => void);
    onSelectionChange?: (snapshot: TableSelectionSnapshot, context: TableSpreadsheetPluginContext) => void;
    onKeyDown?: (event: KeyboardEvent, snapshot: TableSelectionSnapshot, context: TableSpreadsheetPluginContext) => "handled" | void;
}
export interface TableSpreadsheetHandle {
    destroy(): void;
    refresh(): void;
    clearSelection(): void;
    setSelections(selections: Selection[], activeSelection?: Selection | null): void;
    getSelections(): Selection[];
    getActiveSelection(): Selection | null;
    getSelectionSnapshot(): TableSelectionSnapshot;
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