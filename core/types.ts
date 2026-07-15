export interface CellCoordinates {
  rowId: string;
  columnId: string;
}

export interface Selection {
  start: CellCoordinates;
  end: CellCoordinates;
}

export interface SelectableItem {
  id: string;
  /**
   * Marks a column as frozen (left-pinned). Populated for columns by the DOM
   * table model; unused for rows. Enables the freeze-aware selection overlay.
   */
  frozen?: boolean;
}

export interface SelectionBounds {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
}
