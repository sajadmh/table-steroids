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
 * Creates the filled rectangle used for a committed selection.
 */
function createSelectionFill(rect: Omit<OverlayRect, "key">, selectionStroke: string, selectionFill: string) {
  const fill = document.createElement("div");
  setRectStyles(fill, rect);
  fill.style.background = selectionFill;
  fill.style.boxShadow = `inset 0 0 0 1px ${selectionStroke}`;
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

export class SelectionOverlay {
  private root: HTMLDivElement;
  private fillLayer: HTMLDivElement;
  private ringLayer: HTMLDivElement;
  private theme: SpreadsheetOverlayTheme;

  /**
   * Creates the overlay root and its rendering layers.
   */
  constructor(theme: Partial<SpreadsheetOverlayTheme> = {}) {
    this.theme = { ...DEFAULT_OVERLAY_THEME, ...theme };
    this.root = document.createElement("div");
    this.fillLayer = createLayer();
    this.ringLayer = createLayer();

    this.root.setAttribute("aria-hidden", "true");
    this.root.style.position = "fixed";
    this.root.style.inset = "0";
    this.root.style.pointerEvents = "none";
    this.root.style.zIndex = String(this.theme.zIndex);

    this.root.append(this.fillLayer, this.ringLayer);
    document.body.appendChild(this.root);
  }

  /**
   * Renders committed selections, copied outlines, and an optional drag preview.
   */
  render(selectionRects: OverlayRect[], copiedRects: OverlayRect[], dragRect: OverlayRect | null) {
    const fillRects = selectionRects.map((rect) =>
      createSelectionFill(rect, this.theme.selectionStroke, this.theme.selectionFill),
    );
    if (dragRect) {
      const dragFill = document.createElement("div");
      setRectStyles(dragFill, dragRect);
      dragFill.style.background = this.theme.selectionFill;
      fillRects.push(dragFill);
    }

    const copiedRings = copiedRects.map((rect) =>
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
  }
}
