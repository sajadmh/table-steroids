export const DEFAULT_OVERLAY_THEME = {
    selectionFill: "rgba(27, 114, 232, 0.10)",
    selectionStroke: "rgb(27 114 232)",
    copiedOutline: "rgb(27 114 232)",
    copiedOutlineWidth: 1.5,
    zIndex: 40,
};
/**
 * Applies absolute positioning styles for one overlay rectangle.
 */
function setRectStyles(element, rect) {
    element.style.position = "absolute";
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
}
/**
 * Creates one full-screen overlay layer.
 */
function createLayer() {
    const layer = document.createElement("div");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    return layer;
}
/**
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect, selectionStroke, selectionFill) {
    const fill = document.createElement("div");
    setRectStyles(fill, rect);
    fill.style.background = selectionFill;
    fill.style.boxShadow = `inset 0 0 0 1px ${selectionStroke}`;
    return fill;
}
/**
 * Creates the dashed outline used for copied selections.
 */
function createCopiedRing(rect, copiedOutline, copiedOutlineWidth) {
    const ring = document.createElement("div");
    setRectStyles(ring, rect);
    ring.style.outline = `${copiedOutlineWidth}px dashed ${copiedOutline}`;
    ring.style.outlineOffset = "0";
    return ring;
}
/**
 * Trims one viewport-positioned overlay rectangle to a visible clip boundary.
 */
function clipOverlayRect(rect, clipRect) {
    if (!clipRect) {
        return rect;
    }
    const left = Math.max(rect.left, clipRect.left);
    const top = Math.max(rect.top, clipRect.top);
    const right = Math.min(rect.left + rect.width, clipRect.right);
    const bottom = Math.min(rect.top + rect.height, clipRect.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) {
        return null;
    }
    return {
        ...rect,
        left,
        top,
        width,
        height,
    };
}
/**
 * Clips the fixed overlay root itself so outlines cannot bleed past the table viewport.
 */
function setRootClipStyles(root, clipRect) {
    if (!clipRect) {
        root.style.clipPath = "";
        return;
    }
    const rootWidth = root.offsetWidth || Number.parseFloat(root.style.width) || (typeof window.innerWidth === "number" ? window.innerWidth : clipRect.right);
    const rootHeight = root.offsetHeight || Number.parseFloat(root.style.height) || (typeof window.innerHeight === "number" ? window.innerHeight : clipRect.bottom);
    root.style.clipPath = `inset(${clipRect.top}px ${Math.max(0, rootWidth - clipRect.right)}px ${Math.max(0, rootHeight - clipRect.bottom)}px ${clipRect.left}px)`;
}
export class SelectionOverlay {
    /**
     * Creates the overlay root and its rendering layers.
     */
    constructor(theme = {}, host = document.body) {
        this.previousHostPosition = null;
        this.theme = { ...DEFAULT_OVERLAY_THEME, ...theme };
        this.host = host;
        this.mode = host === document.body ? "viewport" : "local";
        this.root = document.createElement("div");
        this.fillLayer = createLayer();
        this.ringLayer = createLayer();
        this.root.setAttribute("aria-hidden", "true");
        this.root.style.pointerEvents = "none";
        this.root.style.zIndex = String(this.theme.zIndex);
        if (this.mode === "local") {
            const hostPosition = typeof window.getComputedStyle === "function" ? window.getComputedStyle(this.host).position : this.host.style.position;
            if (!hostPosition || hostPosition === "static") {
                this.previousHostPosition = this.host.style.position;
                this.host.style.position = "relative";
            }
            this.root.style.position = "absolute";
            this.root.style.left = "0";
            this.root.style.top = "0";
            this.root.style.width = `${this.host.scrollWidth}px`;
            this.root.style.height = `${this.host.scrollHeight}px`;
        }
        else {
            this.root.style.position = "fixed";
            this.root.style.inset = "0";
        }
        this.root.append(this.fillLayer, this.ringLayer);
        this.host.appendChild(this.root);
    }
    /**
     * Renders committed selections, copied outlines, and an optional drag preview.
     */
    render(selectionRects, copiedRects, dragRect, clipRect = null) {
        if (this.mode === "local") {
            this.root.style.width = `${this.host.scrollWidth}px`;
            this.root.style.height = `${this.host.scrollHeight}px`;
        }
        setRootClipStyles(this.root, clipRect);
        const clippedSelectionRects = selectionRects
            .map((rect) => clipOverlayRect(rect, clipRect))
            .filter((rect) => rect !== null);
        const clippedCopiedRects = copiedRects
            .map((rect) => clipOverlayRect(rect, clipRect))
            .filter((rect) => rect !== null);
        const clippedDragRect = dragRect ? clipOverlayRect(dragRect, clipRect) : null;
        const fillRects = clippedSelectionRects.map((rect) => createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill));
        if (clippedDragRect) {
            const dragFill = document.createElement("div");
            setRectStyles(dragFill, clippedDragRect);
            dragFill.style.background = this.theme.selectionFill;
            fillRects.push(dragFill);
        }
        const copiedRings = clippedCopiedRects.map((rect) => createCopiedRing(rect, this.theme.copiedOutline, this.theme.copiedOutlineWidth));
        this.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
        this.fillLayer.replaceChildren(...fillRects);
        this.ringLayer.replaceChildren(...copiedRings);
    }
    /**
     * Removes the overlay from the document.
     */
    destroy() {
        this.root.remove();
        if (this.previousHostPosition !== null) {
            this.host.style.position = this.previousHostPosition;
            this.previousHostPosition = null;
        }
    }
}
//# sourceMappingURL=overlay.js.map