export interface OverlayCornerRadii {
    tl: string;
    tr: string;
    br: string;
    bl: string;
}
/**
 * Per-edge toggle for a selection rectangle's inset border. A `false` edge is
 * suppressed so a selection split across the freeze boundary stays seamless.
 */
export interface EdgeStroke {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}
export interface OverlayRect {
    key: string;
    left: number;
    top: number;
    width: number;
    height: number;
    radius?: OverlayCornerRadii;
    stroke?: EdgeStroke;
}
export interface OverlayClipRect {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface SpreadsheetOverlayTheme {
    selectionFill: string;
    selectionStroke: string;
    copiedOutline: string;
    copiedOutlineWidth: number;
    zIndex: number;
    /**
     * Stacking order for the pinned (frozen-column) overlay layer. Defaults to
     * {@link SpreadsheetOverlayTheme.zIndex} so a table with no frozen columns is
     * indistinguishable from the single-layer overlay. When columns are frozen,
     * set this above `zIndex` and give the frozen body cells a z-index between the
     * two so the pinned selection paints over the scrolling one.
     */
    frozenZIndex?: number;
}
/**
 * One layer's render payload: committed selections, copied outlines, an optional
 * drag preview, and the clip boundary they all paint inside.
 */
export interface OverlayLayerInput {
    selectionRects: OverlayRect[];
    copiedRects: OverlayRect[];
    dragRect: OverlayRect | null;
    clip: OverlayClipRect | null;
}
export interface OverlayFrozenBand {
    left: number;
    width: number;
}
export interface FrozenOverlayLayerInput extends OverlayLayerInput {
    band: OverlayFrozenBand | null;
}
export interface OverlayRenderInput {
    base: OverlayLayerInput;
    frozen: FrozenOverlayLayerInput;
}
export declare const DEFAULT_OVERLAY_THEME: SpreadsheetOverlayTheme;
export declare class SelectionOverlay {
    private base;
    private frozen;
    private theme;
    private host;
    private mode;
    private previousHostPosition;
    /**
     * Creates the two stacked overlay roots (scrolling + pinned) and their layers.
     */
    constructor(theme?: Partial<SpreadsheetOverlayTheme>, host?: HTMLElement);
    /**
     * Builds one overlay root with its fill and ring layers and mounts it on the host.
     */
    private createRoot;
    /**
     * Renders the scrolling and pinned overlay layers from their split payloads.
     */
    render(input: OverlayRenderInput): void;
    /**
     * Runs the clip + paint pipeline for one overlay layer.
     */
    private paintLayer;
    /**
     * Paints frozen rectangles inside one horizontally-sticky band. The root stays
     * in vertical content coordinates; only the inner surface participates in
     * horizontal sticky positioning.
     */
    private paintFrozenLayer;
    /**
     * Removes both overlay roots from the document and restores the host position.
     */
    destroy(): void;
}
//# sourceMappingURL=overlay.d.ts.map