# Changelog

## 0.3.0

- Avoid cloning selections and scanning selected cells when no callback or matching plugin listener needs them.
- Limit npm contents to library ESM modules and declarations; omit standalone browser/bookmarklet bundles and source/declaration maps.
- Serve newly generated bookmarklets from the repository CDN instead of the npm package. Existing npm CDN bookmarklets should be replaced when upgrading.
- Build with declared TypeScript and official React type dependencies, preserving React component, ref, and native table prop types.
- Forward `interactionMode` through both React APIs, share enhancer setup through the hook, and keep the component ref callback stable.

## 0.2.3

### Added

- **Frozen-column-aware selection overlay.** Left-pinned (`position: sticky`, non-`auto` `left`) columns are now detected straight from the DOM (`DOMTableModel.frozenColumnIds`, `column.frozen`). Selections that cross the freeze boundary are split into a pinned piece and a scrolling piece, rendered on two stacked overlay layers, with the interior seam edge suppressed so the highlight stays seamless. Fully backward compatible: with no frozen columns the overlay is byte-for-byte the previous single-layer output.
- **`frozenZIndex` overlay theme field.** Controls the stacking order of the pinned selection layer. Defaults to `zIndex`.

### Pinning mechanism

The pinned overlay layer uses the same mechanism as the base layer: it lives in the content-coordinate space of the scroll container and is recomputed each scroll. A frozen cell's measured content-X grows with `scrollLeft` while the overlay root scrolls with the content, and the two cancel — so the pinned selection stays glued to the (sticky) frozen cells exactly as the base selection stays glued to its scrolling cells.

### Layering contract

The overlay paints on two roots: the base (scrolling) layer at `zIndex` and the pinned layer at `frozenZIndex`. Frozen body cells must sit **between** the two — give them a z-index above `zIndex` and below `frozenZIndex` — so the scrolling selection can't paint over the pins and the pinned selection paints over the frozen cells. See the "Frozen columns" section of the README.

### Notes

- Right-pinned columns are out of scope and are treated as scrolling (single-layer behavior).
- The internal `SelectionOverlay.render` signature changed to accept split `{ base, frozen }` layers. This API is private to `enhance-table`; the public API (`enhanceTable`, `enhanceTables`, `TableSteroids`, options) is unchanged aside from the additive `frozenZIndex` theme field.
