export { copySelectionToText, resolveCopySelection, type CopySelectionPlan } from "./core/copy-plan.js";
export { buildIndexMap, boundsToSelection, canMergeBounds, getBoundingBounds, getBoundsArea, getOverlapArea, getSelectionBounds, getSelectionKey, intersects, isCellSelected, normalizeSelections, resolveActiveSelection, subtractBounds, subtractSelection, toCoordinateKey, } from "./core/geometry.js";
export { restoreSelectionState, snapshotSelectionState, type SelectionStateSnapshot } from "./core/persistence.js";
export type { CellCoordinates, SelectableItem, Selection, SelectionBounds } from "./core/types.js";
