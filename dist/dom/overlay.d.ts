export interface OverlayRect {
    key: string;
    left: number;
    top: number;
    width: number;
    height: number;
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
}
export declare const DEFAULT_OVERLAY_THEME: SpreadsheetOverlayTheme;
export declare class SelectionOverlay {
    private root;
    private fillLayer;
    private ringLayer;
    private theme;
    private host;
    private mode;
    private previousHostPosition;
    /**
     * Creates the overlay root and its rendering layers.
     */
    constructor(theme?: Partial<SpreadsheetOverlayTheme>, host?: HTMLElement);
    /**
     * Renders committed selections, copied outlines, and an optional drag preview.
     */
    render(selectionRects: OverlayRect[], copiedRects: OverlayRect[], dragRect: OverlayRect | null, clipRect?: OverlayClipRect | null): void;
    /**
     * Removes the overlay from the document.
     */
    destroy(): void;
}
//# sourceMappingURL=overlay.d.ts.map