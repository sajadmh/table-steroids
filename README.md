# table-steroids

A tiny package to give your native HTML tables spreadsheet-style selection, copying, and range superpowers.

- `core`: geometry, merge/subtract, copy planning, and selection persistence.
- `dom`: the framework-agnostic enhancer for real `<table>` markup.
- `react`: a React `<table>` component for enhanced tables, plus a hook for existing table refs.

## For app developers

```bash
npm i table-steroids
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

The npm package is designed for desktop and mobile web. By default it auto-selects a desktop or touch interaction model at runtime.

## For non-developers

Enhance any table across the web without installing anything by using a bookmarklet. The bookmarklet is desktop-only.

[Visit this page](http://localhost:9001/2026/table#for-everyone) to drag and drop the bookmarklet onto your bookmarks bar.

Or set up a bookmarklet manually:

1. Create a new bookmark in your browser.
2. Name it `Table Steroids`.
3. Open [`dist/bookmarklet.txt`](https://github.com/sajadmh/table-steroids/blob/main/dist/bookmarklet.txt) and copy its contents into the bookmark URL or location field. Make sure that the URL starts with `javascript:`.

The bookmarklet tries the latest published build first, then falls back to the embedded build if the page blocks external scripts.
If the page blocks both paths, the bookmarklet will show `Script not allowed.`.
Once used, the popup will show `latest version` or `offline version` depending on if the page blocks the script.

## Accessibility contract

- Native table semantics are preserved. The enhancer does not replace `<table>` with a fake grid.
- Keyboard navigation and range expansion work once a managed cell receives focus.
- Interactive descendants like links, buttons, inputs, selects, textareas, `[contenteditable='true']`, and `[data-spreadsheet-ignore]` regions are not hijacked.
- The package intentionally relies on the overlay for visual selection state, rather than adding intrusive per-cell border styles.

## Interaction modes

- `interactionMode: "auto"` is the default for the npm package. It resolves to desktop or touch behavior at runtime.
- `interactionMode: "desktop"` keeps keyboard navigation, modifier-based multi-range selection, and copy shortcuts.
- `interactionMode: "touch"` keeps selection lightweight for phones and tablets: tap to select and drag to expand a range.
- The bookmarklet always uses desktop mode.

## Supported behaviors

- Click-to-select and drag-to-select
- Tap-to-select and drag-to-select on touch devices
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
