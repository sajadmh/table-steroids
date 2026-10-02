"use client";
import * as React from "react";
import { enhanceTable } from "../dom/enhance-table.js";
export function useReactTableSteroids(tableRef, options = {}) {
    const handleRef = React.useRef(null);
    const { allowCellSelection = true, allowRangeSelection = true, activationMode, interactionMode, observeMutations = true, onSelectionCopy, onSelectionChange, getCellText, selectionScope, isSelectableCell, shouldIgnoreEvent, overlay, plugins, } = options;
    React.useEffect(() => {
        const table = tableRef.current;
        if (!table) {
            return;
        }
        const handle = enhanceTable(table, {
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
        handleRef.current = handle;
        return () => {
            handle.destroy();
            if (handleRef.current === handle) {
                handleRef.current = null;
            }
        };
    }, [
        activationMode,
        interactionMode,
        allowCellSelection,
        allowRangeSelection,
        getCellText,
        isSelectableCell,
        observeMutations,
        onSelectionChange,
        onSelectionCopy,
        overlay,
        plugins,
        selectionScope,
        shouldIgnoreEvent,
        tableRef,
    ]);
    return handleRef;
}
