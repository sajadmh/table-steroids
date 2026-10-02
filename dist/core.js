export { copySelectionToText, resolveCopySelection } from "./core/copy-plan.js";
export { buildIndexMap, boundsToSelection, canMergeBounds, getBoundingBounds, getBoundsArea, getOverlapArea, getSelectionBounds, getSelectionKey, intersects, isCellSelected, normalizeSelections, resolveActiveSelection, subtractBounds, subtractSelection, toCoordinateKey, } from "./core/geometry.js";
export { restoreSelectionState, snapshotSelectionState } from "./core/persistence.js";
