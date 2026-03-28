# table-steroids

A tiny package to give your native HTML tables spreadsheet-style selection, copying, and range superpowers.

- `core`: geometry, merge/subtract, copy planning, and selection persistence.
- `dom`: the framework-agnostic enhancer for real `<table>` markup.
- `react`: a React `<table>` component for enhanced tables, plus a hook for existing table refs.

## For app developers

```bash
npm install table-steroids
```

In React, import `TableSteroids` from `table-steroids/react` and use it in place of your normal `<table>`.

```tsx
import { TableSteroids } from "table-steroids/react";

export function PricingTable() {
  return (
    <TableSteroids>
      <thead>...</thead>
      <tbody>...</tbody>
    </TableSteroids>
  );
}
```

If a component already renders the `<table>` elsewhere and provides a ref to the DOM node, use the hook instead:

```tsx
import * as React from "react";
import { useReactTableSteroids } from "table-steroids/react";

export function ExistingTable() {
  const tableRef = React.useRef<HTMLTableElement | null>(null);

  useReactTableSteroids(tableRef);

  return <table ref={tableRef}>...</table>;
}
```

Outside React, enhance real tables directly:

```ts
import { enhanceTable, enhanceTables } from "table-steroids";

enhanceTable(document.querySelector("table")!);
enhanceTables(document);
```

## For non-developers

Enhance any table across the web without installing anything by using a bookmarklet.

<!-- bookmarklet-buttons:start -->

1. Create a new bookmark in your browser.
2. Name it `Table Steroids`.
3. Paste this into the bookmark URL or location field:

```text
javascript:(()=>{const d=document;if(!d)return;const toastId="table-steroids-bookmarklet-toast";const root=d.body||d.documentElement;const existing=d.getElementById(toastId);if(existing){const timeoutId=Number(existing.getAttribute("data-timeout-id")||"0");if(timeoutId){clearTimeout(timeoutId);}existing.remove();}const toast=d.createElement("div");toast.id=toastId;toast.textContent="Enabling table steroids...";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");toast.style.position="fixed";toast.style.top="16px";toast.style.left="50%";toast.style.transform="translateX(-50%)";toast.style.padding="10px 14px";toast.style.borderRadius="10px";toast.style.background="rgba(17,24,39,0.92)";toast.style.color="#fff";toast.style.font="500 14px/1.4 system-ui,sans-serif";toast.style.boxShadow="0 10px 30px rgba(0,0,0,0.2)";toast.style.zIndex="2147483647";toast.style.pointerEvents="none";toast.style.maxWidth="calc(100vw - 32px)";toast.style.whiteSpace="nowrap";toast.style.textOverflow="ellipsis";toast.style.overflow="hidden";root.appendChild(toast);const timeoutId=setTimeout(()=>{toast.remove();},5000);toast.setAttribute("data-timeout-id",String(timeoutId));const s=d.createElement("script");s.onerror=()=>{toast.textContent="Failed to load table steroids";};s.src="https://cdn.jsdelivr.net/npm/table-steroids/dist/bookmarklet-loader.js";s.async=true;(d.head||d.documentElement).appendChild(s);})();
```

Use the latest published build with that bookmarklet. For a self-contained local or unpublished build, copy the single line from [`dist/bookmarklet.inline.txt`](./dist/bookmarklet.inline.txt) into the bookmark URL instead.

<!-- bookmarklet-buttons:end -->

## Accessibility contract

- Native table semantics are preserved. The enhancer does not replace `<table>` with a fake grid.
- Keyboard navigation and range expansion work once a managed cell receives focus.
- Interactive descendants like links, buttons, inputs, selects, textareas, `[contenteditable='true']`, and `[data-spreadsheet-ignore]` regions are not hijacked.
- The package intentionally relies on the overlay for visual selection state, rather than adding intrusive per-cell border styles.

## Supported behaviors

- Click-to-select and drag-to-select
- Cmd/Ctrl additive and subtractive multi-range selection
- Arrow-key navigation plus Shift+arrow range expansion
- Honest clipboard behavior for single, horizontal, vertical, and irregular multi-range copies, including HTML table payloads when the browser allows it
- `rowSpan` and `colSpan` aware modeling for native table cells
- Overlay rendering that tracks scrolling and window resizing
- Selection persistence when the table model rebuilds, including observed DOM mutations and manual refreshes

## What this is not

- Paste
- Sorting, filtering, formulas, and editing UIs
- Virtualized rows
- Full Shadow DOM support
- Arbitrary non-table grids (for now)

## Development

```bash
npm run build
npm test
```
