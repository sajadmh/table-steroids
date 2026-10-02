import type { CellCoordinates, SelectableItem, Selection, SelectionBounds } from "./types.js";
/**
 * Builds a quick lookup from item id to its current index.
 */
export declare function buildIndexMap(items: SelectableItem[]): Record<string, number>;
/**
 * Converts a selection from ids into numeric rectangular bounds.
 */
export declare function getSelectionBounds(selection: Selection, rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): SelectionBounds | null;
/**
 * Converts numeric bounds back into a selection using the current rows and columns.
 */
export declare function boundsToSelection(bounds: SelectionBounds, rows: SelectableItem[], columns: SelectableItem[]): Selection | null;
/**
 * Returns how many cells are covered by rectangular bounds.
 */
export declare function getBoundsArea(bounds: SelectionBounds): number;
/**
 * Returns how many cells two rectangular bounds share.
 */
export declare function getOverlapArea(a: SelectionBounds, b: SelectionBounds): number;
/**
 * Builds the smallest rectangle that contains every bounds in the list.
 */
export declare function getBoundingBounds(boundsList: SelectionBounds[]): SelectionBounds;
/**
 * Checks whether two bounds can be combined into one rectangle without changing covered cells.
 */
export declare function canMergeBounds(a: SelectionBounds, b: SelectionBounds): boolean;
/**
 * Merges adjacent or overlapping selections into the simplest rectangular set.
 */
export declare function normalizeSelections(selections: Selection[], rows: SelectableItem[], columns: SelectableItem[], rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): Selection[];
/**
 * Picks the active selection that still matches the normalized selection set.
 */
export declare function resolveActiveSelection(selections: Selection[], activeSelection: Selection | null, rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): Selection | null;
/**
 * Checks whether two rectangles overlap at all.
 */
export declare function intersects(a: SelectionBounds, b: SelectionBounds): boolean;
/**
 * Removes one rectangular area from another and returns the remaining rectangles.
 */
export declare function subtractBounds(base: SelectionBounds, cut: SelectionBounds): SelectionBounds[];
/**
 * Removes a selection from the current selection set.
 */
export declare function subtractSelection(selections: Selection[], cut: Selection, rows: SelectableItem[], columns: SelectableItem[], rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): Selection[];
/**
 * Checks whether a specific cell is covered by any current selection.
 */
export declare function isCellSelected(rowId: string, columnId: string, selections: Selection[], rowIndexMap: Record<string, number>, columnIndexMap: Record<string, number>): boolean;
/**
 * Produces a stable string key for a selection.
 */
export declare function getSelectionKey(selection?: Selection | null): string;
/**
 * Produces a stable string key for one cell coordinate.
 */
export declare function toCoordinateKey(coordinates: CellCoordinates): string;
