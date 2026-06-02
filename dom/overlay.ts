export interface OverlayCornerRadii {
  tl: string;
  tr: string;
  br: string;
  bl: string;
}

export interface OverlayRect {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  radius?: OverlayCornerRadii;
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

type OverlayMode = "viewport" | "local";

export const DEFAULT_OVERLAY_THEME: SpreadsheetOverlayTheme = {
  selectionFill: "rgba(27, 114, 232, 0.10)",
  selectionStroke: "rgb(27 114 232)",
  copiedOutline: "rgb(27 114 232)",
  copiedOutlineWidth: 1.5,
  zIndex: 40,
};

/**
 * Applies absolute positioning styles for one overlay rectangle.
 */
function setRectStyles(element: HTMLElement, rect: Omit<OverlayRect, "key">) {
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
 * Rounds the corners of one overlay rectangle so the highlight follows a rounded table edge.
 */
function applyOverlayRadius(element: HTMLElement, radius: OverlayCornerRadii | undefined) {
  if (!radius) {
    return;
  }

  element.style.borderRadius = `${radius.tl} ${radius.tr} ${radius.br} ${radius.bl}`;
}

/**
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect: Omit<OverlayRect, "key">, selectionStroke: string, selectionFill: string) {
  const fill = document.createElement("div");
  setRectStyles(fill, rect);
  fill.style.background = selectionFill;
  fill.style.boxShadow = `inset 0 0 0 1px ${selectionStroke}`;
  applyOverlayRadius(fill, rect.radius);
  return fill;
}

/**
 * Creates the dashed outline used for copied selections.
 */
function createCopiedRing(rect: Omit<OverlayRect, "key">, copiedOutline: string, copiedOutlineWidth: number) {
  const ring = document.createElement("div");
  setRectStyles(ring, rect);
  ring.style.outline = `${copiedOutlineWidth}px dashed ${copiedOutline}`;
  ring.style.outlineOffset = "0";
  return ring;
}

/**
 * Trims one viewport-positioned overlay rectangle to a visible clip boundary.
 */
function clipOverlayRect(rect: OverlayRect, clipRect: OverlayClipRect | null) {
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

  // Drop a corner's rounding only when the clip eats into the rounded arc itself.
  // A sub-pixel/border trim (e.g. an overflow:hidden wrapper's 1px border, combined with
  // the floor/ceil expansion of the measured rect) must not square off a corner — only a
  // real scroll-clip that cuts at least the corner radius deep should.
  const trimLeft = left - rect.left;
  const trimTop = top - rect.top;
  const trimRight = rect.left + rect.width - right;
  const trimBottom = rect.top + rect.height - bottom;
  const keepCorner = (value: string, edgeTrimA: number, edgeTrimB: number) => {
    const radiusPx = Number.parseFloat(value) || 0;
    return edgeTrimA < radiusPx && edgeTrimB < radiusPx ? value : "0";
  };
  const radius = rect.radius
    ? {
        tl: keepCorner(rect.radius.tl, trimLeft, trimTop),
        tr: keepCorner(rect.radius.tr, trimRight, trimTop),
        br: keepCorner(rect.radius.br, trimRight, trimBottom),
        bl: keepCorner(rect.radius.bl, trimLeft, trimBottom),
      }
    : undefined;

  return {
    ...rect,
    left,
    top,
    width,
    height,
    radius,
  };
}

/**
 * Clips the fixed overlay root itself so outlines cannot bleed past the table viewport.
 */
function setRootClipStyles(root: HTMLElement, clipRect: OverlayClipRect | null) {
  if (!clipRect) {
    root.style.clipPath = "";
    return;
  }

  const rootWidth = root.offsetWidth || Number.parseFloat(root.style.width) || (typeof window.innerWidth === "number" ? window.innerWidth : clipRect.right);
  const rootHeight =
    root.offsetHeight || Number.parseFloat(root.style.height) || (typeof window.innerHeight === "number" ? window.innerHeight : clipRect.bottom);

  root.style.clipPath = `inset(${clipRect.top}px ${Math.max(0, rootWidth - clipRect.right)}px ${Math.max(
    0,
    rootHeight - clipRect.bottom,
  )}px ${clipRect.left}px)`;
}

export class SelectionOverlay {
  private root: HTMLDivElement;
  private fillLayer: HTMLDivElement;
  private ringLayer: HTMLDivElement;
  private theme: SpreadsheetOverlayTheme;
  private host: HTMLElement;
  private mode: OverlayMode;
  private previousHostPosition: string | null = null;

  /**
   * Creates the overlay root and its rendering layers.
   */
  constructor(theme: Partial<SpreadsheetOverlayTheme> = {}, host: HTMLElement = document.body) {
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
      const hostPosition =
        typeof window.getComputedStyle === "function" ? window.getComputedStyle(this.host).position : this.host.style.position;

      if (!hostPosition || hostPosition === "static") {
        this.previousHostPosition = this.host.style.position;
        this.host.style.position = "relative";
      }

      this.root.style.position = "absolute";
      this.root.style.left = "0";
      this.root.style.top = "0";
      this.root.style.width = `${this.host.scrollWidth}px`;
      this.root.style.height = `${this.host.scrollHeight}px`;
    } else {
      this.root.style.position = "fixed";
      this.root.style.inset = "0";
    }

    this.root.append(this.fillLayer, this.ringLayer);
    this.host.appendChild(this.root);
  }

  /**
   * Renders committed selections, copied outlines, and an optional drag preview.
   */
  render(
    selectionRects: OverlayRect[],
    copiedRects: OverlayRect[],
    dragRect: OverlayRect | null,
    clipRect: OverlayClipRect | null = null,
  ) {
    if (this.mode === "local") {
      this.root.style.width = `${this.host.scrollWidth}px`;
      this.root.style.height = `${this.host.scrollHeight}px`;
    }

    setRootClipStyles(this.root, clipRect);

    const clippedSelectionRects = selectionRects
      .map((rect) => clipOverlayRect(rect, clipRect))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedCopiedRects = copiedRects
      .map((rect) => clipOverlayRect(rect, clipRect))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedDragRect = dragRect ? clipOverlayRect(dragRect, clipRect) : null;
    const fillRects = clippedSelectionRects.map((rect) =>
      createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill),
    );
    if (clippedDragRect) {
      const dragFill = document.createElement("div");
      setRectStyles(dragFill, clippedDragRect);
      dragFill.style.background = this.theme.selectionFill;
      applyOverlayRadius(dragFill, clippedDragRect.radius);
      fillRects.push(dragFill);
    }

    const copiedRings = clippedCopiedRects.map((rect) =>
      createCopiedRing(rect, this.theme.copiedOutline, this.theme.copiedOutlineWidth),
    );

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
