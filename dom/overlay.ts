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

type OverlayMode = "viewport" | "local";

interface OverlayLayer {
  root: HTMLDivElement;
  surface: HTMLDivElement;
  fillLayer: HTMLDivElement;
  ringLayer: HTMLDivElement;
  stickyBand: HTMLDivElement | null;
}

export const DEFAULT_OVERLAY_THEME: SpreadsheetOverlayTheme = {
  selectionFill: "rgba(27, 114, 232, 0.10)",
  selectionStroke: "rgb(27 114 232)",
  copiedOutline: "rgb(27 114 232)",
  copiedOutlineWidth: 1.5,
  zIndex: 40,
  frozenZIndex: 40,
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
 * Builds the inset box-shadow border for a selection fill.
 *
 * A missing stroke draws the full four-sided border in a single shadow — matching
 * the historical single-layer output byte for byte. A supplied {@link EdgeStroke}
 * emits one inset shadow per enabled edge so an interior seam edge can be dropped.
 */
function strokeShadow(stroke: EdgeStroke | undefined, color: string) {
  if (!stroke) {
    return `inset 0 0 0 1px ${color}`;
  }

  const shadows: string[] = [];

  if (stroke.top) {
    shadows.push(`inset 0 1px 0 0 ${color}`);
  }
  if (stroke.right) {
    shadows.push(`inset -1px 0 0 0 ${color}`);
  }
  if (stroke.bottom) {
    shadows.push(`inset 0 -1px 0 0 ${color}`);
  }
  if (stroke.left) {
    shadows.push(`inset 1px 0 0 0 ${color}`);
  }

  return shadows.length > 0 ? shadows.join(", ") : "none";
}

/**
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect: Omit<OverlayRect, "key">, selectionStroke: string, selectionFill: string) {
  const fill = document.createElement("div");
  setRectStyles(fill, rect);
  fill.style.background = selectionFill;
  fill.style.boxShadow = strokeShadow(rect.stroke, selectionStroke);
  applyOverlayRadius(fill, rect.radius);
  return fill;
}

/**
 * Creates the dashed outline used for copied selections.
 *
 * With no stroke override the ring is a single `outline` on all four sides —
 * matching the historical single-layer output. When a copied selection spans the
 * freeze boundary its pieces carry a stroke with the interior seam edge disabled,
 * so the ring falls back to per-side dashed borders to avoid drawing a dashed
 * line down the seam.
 */
function createCopiedRing(rect: Omit<OverlayRect, "key">, copiedOutline: string, copiedOutlineWidth: number) {
  const ring = document.createElement("div");
  setRectStyles(ring, rect);

  if (rect.stroke) {
    const edge = (enabled: boolean) => (enabled ? `${copiedOutlineWidth}px dashed ${copiedOutline}` : "0");
    ring.style.boxSizing = "border-box";
    ring.style.borderTop = edge(rect.stroke.top);
    ring.style.borderRight = edge(rect.stroke.right);
    ring.style.borderBottom = edge(rect.stroke.bottom);
    ring.style.borderLeft = edge(rect.stroke.left);
  } else {
    ring.style.outline = `${copiedOutlineWidth}px dashed ${copiedOutline}`;
    ring.style.outlineOffset = "0";
  }

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
  private base: OverlayLayer;
  private frozen: OverlayLayer;
  private theme: SpreadsheetOverlayTheme;
  private host: HTMLElement;
  private mode: OverlayMode;
  private previousHostPosition: string | null = null;

  /**
   * Creates the two stacked overlay roots (scrolling + pinned) and their layers.
   */
  constructor(theme: Partial<SpreadsheetOverlayTheme> = {}, host: HTMLElement = document.body) {
    this.theme = { ...DEFAULT_OVERLAY_THEME, ...theme };
    this.host = host;
    this.mode = host === document.body ? "viewport" : "local";

    if (this.mode === "local") {
      const hostPosition =
        typeof window.getComputedStyle === "function" ? window.getComputedStyle(this.host).position : this.host.style.position;

      if (!hostPosition || hostPosition === "static") {
        this.previousHostPosition = this.host.style.position;
        this.host.style.position = "relative";
      }
    }

    const frozenZIndex = this.theme.frozenZIndex ?? this.theme.zIndex;
    // Append the scrolling layer first so it sits under the pinned layer, and so
    // DOM-order lookups (tests, tooling) resolve the primary root first.
    this.base = this.createRoot("base", this.theme.zIndex);
    this.frozen = this.createRoot("frozen", frozenZIndex);
  }

  /**
   * Builds one overlay root with its fill and ring layers and mounts it on the host.
   */
  private createRoot(kind: "base" | "frozen", zIndex: number): OverlayLayer {
    const root = document.createElement("div");
    const stickyBand = kind === "frozen" ? document.createElement("div") : null;
    const surface = stickyBand ?? root;
    const fillLayer = createLayer();
    const ringLayer = createLayer();

    root.setAttribute("aria-hidden", "true");
    root.setAttribute("data-table-steroids-overlay", kind);
    root.style.pointerEvents = "none";
    root.style.zIndex = String(zIndex);

    if (this.mode === "local") {
      root.style.position = "absolute";
      root.style.left = "0";
      root.style.top = "0";
      root.style.width = `${this.host.scrollWidth}px`;
      root.style.height = `${this.host.scrollHeight}px`;
    } else {
      root.style.position = "fixed";
      root.style.inset = "0";
    }

    if (stickyBand) {
      stickyBand.style.position = "sticky";
      stickyBand.style.height = "100%";
      stickyBand.style.overflow = "hidden";
      stickyBand.append(fillLayer, ringLayer);
      root.appendChild(stickyBand);
    } else {
      root.append(fillLayer, ringLayer);
    }

    this.host.appendChild(root);
    return { root, surface, fillLayer, ringLayer, stickyBand };
  }

  /**
   * Renders the scrolling and pinned overlay layers from their split payloads.
   */
  render(input: OverlayRenderInput) {
    this.paintLayer(this.base, input.base);
    this.paintFrozenLayer(input.frozen);
  }

  /**
   * Runs the clip + paint pipeline for one overlay layer.
   */
  private paintLayer(layer: OverlayLayer, input: OverlayLayerInput) {
    if (this.mode === "local") {
      layer.root.style.width = `${this.host.scrollWidth}px`;
      layer.root.style.height = `${this.host.scrollHeight}px`;
    }

    setRootClipStyles(layer.root, input.clip);

    const clippedSelectionRects = input.selectionRects
      .map((rect) => clipOverlayRect(rect, input.clip))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedCopiedRects = input.copiedRects
      .map((rect) => clipOverlayRect(rect, input.clip))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedDragRect = input.dragRect ? clipOverlayRect(input.dragRect, input.clip) : null;
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

    layer.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
    layer.fillLayer.replaceChildren(...fillRects);
    layer.ringLayer.replaceChildren(...copiedRings);
  }

  /**
   * Paints frozen rectangles inside one horizontally-sticky band. The root stays
   * in vertical content coordinates; only the inner surface participates in
   * horizontal sticky positioning.
   */
  private paintFrozenLayer(input: FrozenOverlayLayerInput) {
    const layer = this.frozen;

    if (this.mode === "local") {
      layer.root.style.width = `${this.host.scrollWidth}px`;
      layer.root.style.height = `${this.host.scrollHeight}px`;
    }

    // Native overflow on the sticky band and its real ancestors owns frozen
    // clipping. In particular, never chase scrollLeft with a root clip-path.
    layer.root.style.clipPath = "";

    if (!input.band || !layer.stickyBand) {
      layer.root.style.display = "none";
      layer.fillLayer.replaceChildren();
      layer.ringLayer.replaceChildren();
      return;
    }

    layer.stickyBand.style.left = `${input.band.left}px`;
    layer.stickyBand.style.width = `${input.band.width}px`;

    const clippedSelectionRects = input.selectionRects
      .map((rect) => clipOverlayRect(rect, input.clip))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedCopiedRects = input.copiedRects
      .map((rect) => clipOverlayRect(rect, input.clip))
      .filter((rect): rect is OverlayRect => rect !== null);
    const clippedDragRect = input.dragRect ? clipOverlayRect(input.dragRect, input.clip) : null;
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

    layer.root.style.display = fillRects.length > 0 || copiedRings.length > 0 ? "block" : "none";
    layer.fillLayer.replaceChildren(...fillRects);
    layer.ringLayer.replaceChildren(...copiedRings);
  }

  /**
   * Removes both overlay roots from the document and restores the host position.
   */
  destroy() {
    this.base.root.remove();
    this.frozen.root.remove();

    if (this.previousHostPosition !== null) {
      this.host.style.position = this.previousHostPosition;
      this.previousHostPosition = null;
    }
  }
}
