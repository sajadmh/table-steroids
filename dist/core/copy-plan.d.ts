import type { SelectableItem, Selection } from "./types.js";
export interface CopySelectionPlan {
    mode: "single" | "horizontal" | "vertical";
    selections: Selection[];
}
/**
 * Chooses the simplest copy mode that preserves the current multi-selection shape.
 */
export declare function resolveCopySelection(selections: Selection[], activeSelection: Selection | null, rows: SelectableItem[], columns: SelectableItem[]): CopySelectionPlan | null;
/**
 * Converts a copy plan into tab/newline-delimited spreadsheet text.
 */
export declare function copySelectionToText(plan: CopySelectionPlan, rows: SelectableItem[], columns: SelectableItem[], getCellValue: (rowId: string, columnId: string) => unknown): string;
