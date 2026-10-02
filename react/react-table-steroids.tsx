"use client";

import * as React from "react";
import type { TableSpreadsheetOptions } from "../dom/enhance-table.js";
import { useReactTableSteroids } from "./use-react-table-steroids.js";

export interface TableSteroidsProps extends React.TableHTMLAttributes<HTMLTableElement>, TableSpreadsheetOptions {
  children?: React.ReactNode;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref && typeof ref === "object") {
    (ref as { current: T | null }).current = value;
  }
}

export const TableSteroids = React.forwardRef<HTMLTableElement, TableSteroidsProps>(
  function TableSteroidsWithRef(
    {
      allowCellSelection = true,
      allowRangeSelection = true,
      activationMode,
      interactionMode,
      observeMutations = true,
      onSelectionCopy,
      onSelectionChange,
      getCellText,
      selectionScope,
      isSelectableCell,
      shouldIgnoreEvent,
      overlay,
      plugins,
      ...tableProps
    },
    forwardedRef,
  ) {
    const tableRef = React.useRef<HTMLTableElement | null>(null);

    useReactTableSteroids(tableRef, {
      allowCellSelection,
      allowRangeSelection,
      activationMode,
      interactionMode,
      observeMutations,
      onSelectionCopy,
      onSelectionChange,
      getCellText,
      selectionScope,
      isSelectableCell,
      shouldIgnoreEvent,
      overlay,
      plugins,
    });

    const ref = React.useCallback((node: HTMLTableElement | null) => {
      tableRef.current = node;
      assignRef(forwardedRef, node);
    }, [forwardedRef]);

    return React.createElement("table", {
      ...tableProps,
      ref,
    });
  },
);
