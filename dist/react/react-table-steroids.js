"use client";
import * as React from "react";
import { useReactTableSteroids } from "./use-react-table-steroids.js";
function assignRef(ref, value) {
    if (typeof ref === "function") {
        ref(value);
        return;
    }
    if (ref && typeof ref === "object") {
        ref.current = value;
    }
}
export const TableSteroids = React.forwardRef(function TableSteroidsWithRef({ allowCellSelection = true, allowRangeSelection = true, activationMode, interactionMode, observeMutations = true, onSelectionCopy, onSelectionChange, getCellText, selectionScope, isSelectableCell, shouldIgnoreEvent, overlay, plugins, ...tableProps }, forwardedRef) {
    const tableRef = React.useRef(null);
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
    const ref = React.useCallback((node) => {
        tableRef.current = node;
        assignRef(forwardedRef, node);
    }, [forwardedRef]);
    return React.createElement("table", {
        ...tableProps,
        ref,
    });
});
