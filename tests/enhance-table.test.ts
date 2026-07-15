import assert from "node:assert/strict";
import test from "node:test";

type Listener = (event: FakeEvent) => void;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

class FakeEvent {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented = false;
  target: FakeElement | FakeDocument | null = null;
  currentTarget: FakeElement | FakeDocument | FakeWindow | null = null;
  readonly [key: string]: unknown;

  constructor(type: string, init: Record<string, unknown> = {}) {
    this.type = type;
    this.bubbles = (init.bubbles as boolean | undefined) ?? true;
    this.cancelable = (init.cancelable as boolean | undefined) ?? true;
    Object.assign(this, init);
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

class FakeWindow {
  private listeners = new Map<string, Set<Listener>>();
  private animationFrames = new Map<number, FrameRequestCallback>();
  private nextAnimationFrameId = 1;
  private queuesAnimationFrames = false;
  innerWidth = 1024;
  innerHeight = 768;

  addEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.add(listener) ?? this.listeners.set(type, new Set([listener]));
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: FakeEvent) {
    event.currentTarget = this;
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }

  matchMedia() {
    return { matches: false };
  }

  getComputedStyle(element: FakeElement) {
    return element.style;
  }

  requestAnimationFrame(callback: FrameRequestCallback) {
    const id = this.nextAnimationFrameId;
    this.nextAnimationFrameId += 1;

    if (this.queuesAnimationFrames) {
      this.animationFrames.set(id, callback);
    } else {
      callback(0);
    }

    return id;
  }

  cancelAnimationFrame(id: number) {
    this.animationFrames.delete(id);
  }

  setAnimationFrameQueueing(enabled: boolean) {
    this.queuesAnimationFrames = enabled;
  }

  flushAnimationFrames() {
    const callbacks = Array.from(this.animationFrames.values());
    this.animationFrames.clear();
    callbacks.forEach((callback) => callback(0));
  }

  get pendingAnimationFrameCount() {
    return this.animationFrames.size;
  }
}

class FakeDocument {
  head: FakeHTMLElement;
  body: FakeHTMLElement;
  documentElement: FakeHTMLElement;
  activeElement: FakeElement | null = null;
  elementFromPointResolver: ((clientX: number, clientY: number) => FakeElement | null) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor() {
    this.documentElement = new FakeHTMLElement("html", this);
    this.head = new FakeHTMLElement("head", this);
    this.body = new FakeHTMLElement("body", this);

    this.documentElement.append(this.head, this.body);
    this.documentElement.connect();
  }

  createElement(tagName: string) {
    const tag = tagName.toLowerCase();

    if (tag === "table") {
      return new FakeHTMLTableElement(this);
    }
    if (tag === "thead" || tag === "tbody") {
      return new FakeHTMLTableSectionElement(tag, this);
    }
    if (tag === "tr") {
      return new FakeHTMLTableRowElement(this);
    }
    if (tag === "td" || tag === "th") {
      return new FakeHTMLTableCellElement(tag, this);
    }
    if (tag === "div" || tag === "span" || tag === "style" || tag === "button" || tag === "a") {
      return new FakeHTMLElement(tag, this);
    }

    return new FakeHTMLElement(tag, this);
  }

  getElementById(id: string) {
    const walk = (node: FakeElement): FakeElement | null => {
      if (node.id === id) {
        return node;
      }

      for (const child of node.childNodes) {
        const match = walk(child);

        if (match) {
          return match;
        }
      }

      return null;
    };

    return walk(this.documentElement);
  }

  elementFromPoint(clientX: number, clientY: number) {
    return this.elementFromPointResolver?.(clientX, clientY) ?? null;
  }

  execCommand() {
    return true;
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.add(listener) ?? this.listeners.set(type, new Set([listener]));
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: FakeEvent) {
    event.currentTarget = this;
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
}

class FakeElement {
  tagName: string;
  ownerDocument: FakeDocument;
  parentElement: FakeElement | null = null;
  childNodes: FakeElement[] = [];
  style: Record<string, string> = {};
  textContent = "";
  innerText = "";
  isConnected = false;
  id = "";
  scrollLeft = 0;
  scrollTop = 0;
  scrollWidth = 0;
  scrollHeight = 0;
  clientWidth = 0;
  clientHeight = 0;
  private attributes = new Map<string, string>();
  private listeners = new Map<string, Set<Listener>>();
  private rect: Rect = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
  };

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
  }

  appendChild(child: FakeElement) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);

    if (this.isConnected) {
      child.connect();
    }

    return child;
  }

  append(...children: FakeElement[]) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children: FakeElement[]) {
    this.childNodes.forEach((child) => {
      child.parentElement = null;
      child.isConnected = false;
    });
    this.childNodes = [];
    this.append(...children);
  }

  remove() {
    if (!this.parentElement) {
      return;
    }

    const nextChildren = this.parentElement.childNodes.filter((child) => child !== this);
    this.parentElement.childNodes = nextChildren;
    this.parentElement = null;
    this.isConnected = false;
  }

  connect() {
    this.isConnected = true;
    this.childNodes.forEach((child) => child.connect());
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.add(listener) ?? this.listeners.set(type, new Set([listener]));
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: FakeEvent) {
    event.target ??= this;

    let current: FakeElement | null = this;

    while (current) {
      event.currentTarget = current;
      current.listeners.get(event.type)?.forEach((listener) => listener(event));

      if (!event.bubbles) {
        break;
      }

      current = current.parentElement;
    }

    return !event.defaultPrevented;
  }

  contains(candidate: unknown): candidate is FakeElement {
    if (!(candidate instanceof FakeElement)) {
      return false;
    }

    let current: FakeElement | null = candidate;

    while (current) {
      if (current === this) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  }

  closest(selectorList: string) {
    const selectors = selectorList.split(",").map((selector) => selector.trim());
    let current: FakeElement | null = this;

    while (current) {
      if (selectors.some((selector) => current.matches(selector))) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  matches(selector: string) {
    if (selector === "th") {
      return this.tagName === "TH";
    }
    if (selector === "td") {
      return this.tagName === "TD";
    }
    if (selector === "button") {
      return this.tagName === "BUTTON";
    }
    if (selector === "input") {
      return this.tagName === "INPUT";
    }
    if (selector === "select") {
      return this.tagName === "SELECT";
    }
    if (selector === "textarea") {
      return this.tagName === "TEXTAREA";
    }
    if (selector === "a[href]") {
      return this.tagName === "A" && this.hasAttribute("href");
    }
    if (selector === "[contenteditable='true']") {
      return this.getAttribute("contenteditable") === "true";
    }
    if (selector === "[data-spreadsheet-ignore]" || selector === "[data-table-steroids-ignore]") {
      return this.hasAttribute(selector.slice(1, -1));
    }

    return false;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);

    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);

    if (name === "id") {
      this.id = "";
    }
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  select() {}

  setBoundingClientRect(rect: Rect) {
    this.rect = rect;
    this.clientWidth = rect.width;
    this.clientHeight = rect.height;
    this.scrollWidth = Math.max(this.scrollWidth, rect.width);
    this.scrollHeight = Math.max(this.scrollHeight, rect.height);
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

class FakeHTMLElement extends FakeElement {}

class FakeHTMLTableCellElement extends FakeHTMLElement {
  rowSpan = 1;
  colSpan = 1;

  constructor(tagName: string, ownerDocument: FakeDocument) {
    super(tagName, ownerDocument);
  }
}

class FakeHTMLTableRowElement extends FakeHTMLElement {
  constructor(ownerDocument: FakeDocument) {
    super("tr", ownerDocument);
  }

  get cells() {
    return this.childNodes.filter((child): child is FakeHTMLTableCellElement => child instanceof FakeHTMLTableCellElement);
  }
}

class FakeHTMLTableSectionElement extends FakeHTMLElement {
  constructor(tagName: string, ownerDocument: FakeDocument) {
    super(tagName, ownerDocument);
  }

  get rows() {
    return this.childNodes.filter((child): child is FakeHTMLTableRowElement => child instanceof FakeHTMLTableRowElement);
  }
}

class FakeHTMLTableElement extends FakeHTMLElement {
  setPointerCaptureCalls = 0;
  releasePointerCaptureCalls = 0;
  private capturedPointerIds = new Set<number>();

  constructor(ownerDocument: FakeDocument) {
    super("table", ownerDocument);
  }

  get rows() {
    return this.childNodes.flatMap((child) =>
      child instanceof FakeHTMLTableSectionElement ? child.rows : child instanceof FakeHTMLTableRowElement ? [child] : [],
    );
  }

  get tBodies() {
    return this.childNodes.filter(
      (child): child is FakeHTMLTableSectionElement => child instanceof FakeHTMLTableSectionElement && child.tagName === "TBODY",
    );
  }

  setPointerCapture(pointerId: number) {
    this.setPointerCaptureCalls += 1;
    this.capturedPointerIds.add(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.releasePointerCaptureCalls += 1;
    this.capturedPointerIds.delete(pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.capturedPointerIds.has(pointerId);
  }
}

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

function installFakeDom() {
  const previousGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLTableElement: globalThis.HTMLTableElement,
    HTMLTableSectionElement: globalThis.HTMLTableSectionElement,
    HTMLTableRowElement: globalThis.HTMLTableRowElement,
    HTMLTableCellElement: globalThis.HTMLTableCellElement,
    MutationObserver: globalThis.MutationObserver,
    ResizeObserver: globalThis.ResizeObserver,
    getComputedStyle: globalThis.getComputedStyle,
  };
  const document = new FakeDocument();
  const window = new FakeWindow();

  Object.assign(globalThis, {
    document,
    window,
    Element: FakeElement,
    HTMLElement: FakeHTMLElement,
    HTMLTableElement: FakeHTMLTableElement,
    HTMLTableSectionElement: FakeHTMLTableSectionElement,
    HTMLTableRowElement: FakeHTMLTableRowElement,
    HTMLTableCellElement: FakeHTMLTableCellElement,
    MutationObserver: FakeMutationObserver,
    ResizeObserver: FakeResizeObserver,
    getComputedStyle: (element: FakeElement) => window.getComputedStyle(element),
  });

  return {
    document,
    window,
    restore() {
      Object.assign(globalThis, previousGlobals);
    },
  };
}

function createPointerEvent(type: string, init: Record<string, unknown>) {
  return new FakeEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...init,
  });
}

function createKeyboardEvent(type: string, init: Record<string, unknown>) {
  return new FakeEvent(type, {
    bubbles: true,
    cancelable: true,
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  });
}

function getCellCenter(cell: FakeHTMLTableCellElement) {
  const rect = cell.getBoundingClientRect();

  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

function clickCell(table: FakeHTMLTableElement, cell: FakeHTMLTableCellElement, init: Record<string, unknown> = {}) {
  const { clientX, clientY } = getCellCenter(cell);

  cell.dispatchEvent(createPointerEvent("pointerdown", { clientX, clientY, ...init }));
  table.dispatchEvent(createPointerEvent("pointerup", { clientX, clientY, ...init }));
}

function createTableFixture(document: FakeDocument) {
  const table = document.createElement("table") as FakeHTMLTableElement;
  const tbody = document.createElement("tbody") as FakeHTMLTableSectionElement;
  const row = document.createElement("tr") as FakeHTMLTableRowElement;
  const firstCell = document.createElement("td") as FakeHTMLTableCellElement;
  const secondCell = document.createElement("td") as FakeHTMLTableCellElement;

  row.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  table.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  firstCell.setBoundingClientRect({ left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20 });
  secondCell.setBoundingClientRect({ left: 50, top: 0, right: 100, bottom: 20, width: 50, height: 20 });

  row.append(firstCell, secondCell);
  tbody.append(row);
  table.append(tbody);
  document.body.appendChild(table);
  document.elementFromPointResolver = (clientX) => (clientX < 50 ? firstCell : secondCell);

  return {
    table,
    tbody,
    row,
    firstCell,
    secondCell,
  };
}

function createGridTableFixture(document: FakeDocument) {
  const table = document.createElement("table") as FakeHTMLTableElement;
  const tbody = document.createElement("tbody") as FakeHTMLTableSectionElement;
  const firstRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const secondRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const topLeft = document.createElement("td") as FakeHTMLTableCellElement;
  const topRight = document.createElement("td") as FakeHTMLTableCellElement;
  const bottomLeft = document.createElement("td") as FakeHTMLTableCellElement;
  const bottomRight = document.createElement("td") as FakeHTMLTableCellElement;

  firstRow.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  secondRow.setBoundingClientRect({ left: 0, top: 20, right: 100, bottom: 40, width: 100, height: 20 });
  table.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 });
  topLeft.setBoundingClientRect({ left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20 });
  topRight.setBoundingClientRect({ left: 50, top: 0, right: 100, bottom: 20, width: 50, height: 20 });
  bottomLeft.setBoundingClientRect({ left: 0, top: 20, right: 50, bottom: 40, width: 50, height: 20 });
  bottomRight.setBoundingClientRect({ left: 50, top: 20, right: 100, bottom: 40, width: 50, height: 20 });

  firstRow.append(topLeft, topRight);
  secondRow.append(bottomLeft, bottomRight);
  tbody.append(firstRow, secondRow);
  table.append(tbody);
  document.body.appendChild(table);
  document.elementFromPointResolver = (clientX, clientY) => {
    if (clientY < 20) {
      return clientX < 50 ? topLeft : topRight;
    }

    return clientX < 50 ? bottomLeft : bottomRight;
  };

  return {
    table,
    cells: {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    },
  };
}

function createColSpanTableFixture(document: FakeDocument) {
  const table = document.createElement("table") as FakeHTMLTableElement;
  const tbody = document.createElement("tbody") as FakeHTMLTableSectionElement;
  const firstRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const secondRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const spanningCell = document.createElement("td") as FakeHTMLTableCellElement;
  const bottomLeft = document.createElement("td") as FakeHTMLTableCellElement;
  const bottomRight = document.createElement("td") as FakeHTMLTableCellElement;

  spanningCell.colSpan = 2;
  firstRow.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  secondRow.setBoundingClientRect({ left: 0, top: 20, right: 100, bottom: 40, width: 100, height: 20 });
  table.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 });
  spanningCell.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  bottomLeft.setBoundingClientRect({ left: 0, top: 20, right: 50, bottom: 40, width: 50, height: 20 });
  bottomRight.setBoundingClientRect({ left: 50, top: 20, right: 100, bottom: 40, width: 50, height: 20 });

  firstRow.append(spanningCell);
  secondRow.append(bottomLeft, bottomRight);
  tbody.append(firstRow, secondRow);
  table.append(tbody);
  document.body.appendChild(table);

  return {
    table,
    cells: {
      spanningCell,
      bottomLeft,
      bottomRight,
    },
  };
}

function getOverlayRoot(document: FakeDocument) {
  const walk = (element: FakeElement): FakeHTMLElement | undefined => {
    if (element.getAttribute("aria-hidden") === "true") {
      return element as FakeHTMLElement;
    }

    for (const child of element.childNodes) {
      const match = walk(child);

      if (match) {
        return match;
      }
    }

    return undefined;
  };

  return walk(document.body);
}

test("enhanceTable waits to capture desktop pointer drags until the drag threshold is crossed", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, firstCell } = createTableFixture(document);
    const handle = enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    const pointerDown = createPointerEvent("pointerdown", { clientX: 10, clientY: 10 });

    firstCell.dispatchEvent(pointerDown);

    assert.equal(pointerDown.defaultPrevented, false);
    assert.equal(table.setPointerCaptureCalls, 0);
    assert.deepEqual(handle.getActiveSelection(), {
      start: { rowId: "row-0", columnId: "column-0" },
      end: { rowId: "row-0", columnId: "column-0" },
    });

    table.dispatchEvent(createPointerEvent("pointermove", { clientX: 12, clientY: 12 }));

    assert.equal(table.setPointerCaptureCalls, 0);

    table.dispatchEvent(createPointerEvent("pointermove", { clientX: 70, clientY: 10 }));

    assert.equal(table.setPointerCaptureCalls, 1);

    table.dispatchEvent(createPointerEvent("pointerup", { clientX: 70, clientY: 10 }));

    assert.equal(table.releasePointerCaptureCalls, 1);
    assert.deepEqual(handle.getActiveSelection(), {
      start: { rowId: "row-0", columnId: "column-0" },
      end: { rowId: "row-0", columnId: "column-1" },
    });
  } finally {
    restore();
  }
});

test("enhanceTable clips overlay rectangles to scrolling ancestors", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const scroller = document.createElement("div") as FakeHTMLElement;

    table.remove();
    scroller.style.overflow = "auto";
    scroller.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 });
    scroller.scrollHeight = 40;
    scroller.appendChild(table);
    document.body.appendChild(scroller);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });

    const overlayRoot = getOverlayRoot(document);
    const fillLayer = overlayRoot?.childNodes[0];
    const selectionFill = fillLayer?.childNodes[0];

    assert.equal(overlayRoot?.parentElement, scroller);
    assert.equal(scroller.style.position, "relative");
    assert.equal(overlayRoot?.style.position, "absolute");
    assert.equal(overlayRoot?.style.clipPath, "inset(0px 0px 10px 0px)");
    assert.equal(selectionFill?.style.left, "0px");
    assert.equal(selectionFill?.style.top, "0px");
    assert.equal(selectionFill?.style.width, "100px");
    assert.equal(selectionFill?.style.height, "30px");
  } finally {
    restore();
  }
});

function roundTable(table: FakeHTMLTableElement, radius = "8px") {
  table.style.borderTopLeftRadius = radius;
  table.style.borderTopRightRadius = radius;
  table.style.borderBottomRightRadius = radius;
  table.style.borderBottomLeftRadius = radius;
}

function getSelectionFill(document: FakeDocument) {
  const overlayRoot = getOverlayRoot(document);
  const fillLayer = overlayRoot?.childNodes[0];

  return fillLayer?.childNodes[0];
}

test("enhanceTable rounds the selection corners that meet a rounded table edge", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);

    roundTable(table);
    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });

    // Selecting the whole grid puts every selection corner at a table corner.
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });
    assert.equal(getSelectionFill(document)?.style.borderRadius, "8px 8px 8px 8px");

    // A single corner cell only rounds the matching corner.
    clickCell(table, cells.topLeft);
    assert.equal(getSelectionFill(document)?.style.borderRadius, "8px 0 0 0");

    clickCell(table, cells.bottomRight);
    assert.equal(getSelectionFill(document)?.style.borderRadius, "0 0 8px 0");
  } finally {
    restore();
  }
});

test("enhanceTable leaves the selection square when the table is not rounded", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });

    assert.equal(getSelectionFill(document)?.style.borderRadius ?? "", "");
  } finally {
    restore();
  }
});

test("enhanceTable drops rounded corners on selection edges trimmed by a scroll ancestor", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const scroller = document.createElement("div") as FakeHTMLElement;

    table.remove();
    roundTable(table);
    scroller.style.overflow = "auto";
    scroller.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 });
    scroller.scrollHeight = 40;
    scroller.appendChild(table);
    document.body.appendChild(scroller);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });

    // The bottom 10px is clipped away, so the bottom corners must not stay rounded.
    assert.equal(getSelectionFill(document)?.style.borderRadius, "8px 8px 0 0");
  } finally {
    restore();
  }
});

test("enhanceTable keeps rounded corners when the clip trims less than the corner radius", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const scroller = document.createElement("div") as FakeHTMLElement;

    table.remove();
    roundTable(table);
    scroller.style.overflow = "hidden";
    // 1px smaller than the table on the right and bottom — mimics an overflow:hidden
    // wrapper's border combined with the measured rect's floor/ceil expansion.
    scroller.setBoundingClientRect({ left: 0, top: 0, right: 99, bottom: 39, width: 99, height: 39 });
    scroller.scrollWidth = 100;
    scroller.scrollHeight = 40;
    scroller.appendChild(table);
    document.body.appendChild(scroller);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });

    // A 1px trim is far less than the 8px radius, so every corner stays rounded.
    assert.equal(getSelectionFill(document)?.style.borderRadius, "8px 8px 8px 8px");
  } finally {
    restore();
  }
});

test("enhanceTable ignores descendants marked with data-table-steroids-ignore", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, firstCell } = createTableFixture(document);
    const ignoredHandle = document.createElement("div") as FakeHTMLElement;

    ignoredHandle.setAttribute("data-table-steroids-ignore", "");
    firstCell.appendChild(ignoredHandle);

    const handle = enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    const pointerDown = createPointerEvent("pointerdown", { clientX: 10, clientY: 10 });

    ignoredHandle.dispatchEvent(pointerDown);
    table.dispatchEvent(createPointerEvent("pointerup", { clientX: 10, clientY: 10 }));

    assert.equal(pointerDown.defaultPrevented, false);
    assert.deepEqual(handle.getSelections(), []);
  } finally {
    restore();
  }
});

test("enhanceTable only manages tbody cells when selectionScope is tbody", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const table = document.createElement("table") as FakeHTMLTableElement;
    const thead = document.createElement("thead") as FakeHTMLTableSectionElement;
    const tbody = document.createElement("tbody") as FakeHTMLTableSectionElement;
    const headerRow = document.createElement("tr") as FakeHTMLTableRowElement;
    const bodyRow = document.createElement("tr") as FakeHTMLTableRowElement;
    const headerCell = document.createElement("th") as FakeHTMLTableCellElement;
    const bodyCell = document.createElement("td") as FakeHTMLTableCellElement;

    headerRow.appendChild(headerCell);
    bodyRow.appendChild(bodyCell);
    thead.appendChild(headerRow);
    tbody.appendChild(bodyRow);
    table.append(thead, tbody);
    document.body.appendChild(table);

    enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      selectionScope: "tbody",
    });

    assert.equal(headerCell.getAttribute("tabindex"), null);
    assert.equal(headerCell.getAttribute("data-table-steroids-cell"), null);
    assert.equal(bodyCell.getAttribute("tabindex"), "-1");
    assert.equal(bodyCell.getAttribute("data-table-steroids-cell"), "true");
  } finally {
    restore();
  }
});

test("enhanceTable returns single-cell and rectangular selection snapshots", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const handle = enhanceTable(table, { interactionMode: "desktop", observeMutations: false });

    clickCell(table, cells.topLeft);

    assert.deepEqual(handle.getSelectionSnapshot(), {
      selections: [{ start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-0", columnId: "column-0" } }],
      activeSelection: { start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-0", columnId: "column-0" } },
      bounds: [{ minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 0 }],
      selectedCells: [
        {
          id: "cell-0-0-0",
          rowId: "row-0",
          columnId: "column-0",
          rowIndex: 0,
          columnIndex: 0,
          element: cells.topLeft,
          aliases: [{ rowId: "row-0", columnId: "column-0" }],
        },
      ],
    });

    clickCell(table, cells.bottomRight, { shiftKey: true });

    assert.deepEqual(handle.getSelectionSnapshot(), {
      selections: [{ start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-1", columnId: "column-1" } }],
      activeSelection: { start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-1", columnId: "column-1" } },
      bounds: [{ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 }],
      selectedCells: [
        {
          id: "cell-0-0-0",
          rowId: "row-0",
          columnId: "column-0",
          rowIndex: 0,
          columnIndex: 0,
          element: cells.topLeft,
          aliases: [{ rowId: "row-0", columnId: "column-0" }],
        },
        {
          id: "cell-0-1-1",
          rowId: "row-0",
          columnId: "column-1",
          rowIndex: 0,
          columnIndex: 1,
          element: cells.topRight,
          aliases: [{ rowId: "row-0", columnId: "column-1" }],
        },
        {
          id: "cell-1-0-0",
          rowId: "row-1",
          columnId: "column-0",
          rowIndex: 1,
          columnIndex: 0,
          element: cells.bottomLeft,
          aliases: [{ rowId: "row-1", columnId: "column-0" }],
        },
        {
          id: "cell-1-1-1",
          rowId: "row-1",
          columnId: "column-1",
          rowIndex: 1,
          columnIndex: 1,
          element: cells.bottomRight,
          aliases: [{ rowId: "row-1", columnId: "column-1" }],
        },
      ],
    });
  } finally {
    restore();
  }
});

test("enhanceTable returns multi-range selection snapshots", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const handle = enhanceTable(table, { interactionMode: "desktop", observeMutations: false });

    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { ctrlKey: true });

    assert.deepEqual(handle.getSelectionSnapshot(), {
      selections: [
        { start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-0", columnId: "column-0" } },
        { start: { rowId: "row-1", columnId: "column-1" }, end: { rowId: "row-1", columnId: "column-1" } },
      ],
      activeSelection: { start: { rowId: "row-1", columnId: "column-1" }, end: { rowId: "row-1", columnId: "column-1" } },
      bounds: [
        { minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 0 },
        { minRow: 1, maxRow: 1, minColumn: 1, maxColumn: 1 },
      ],
      selectedCells: [
        {
          id: "cell-0-0-0",
          rowId: "row-0",
          columnId: "column-0",
          rowIndex: 0,
          columnIndex: 0,
          element: cells.topLeft,
          aliases: [{ rowId: "row-0", columnId: "column-0" }],
        },
        {
          id: "cell-1-1-1",
          rowId: "row-1",
          columnId: "column-1",
          rowIndex: 1,
          columnIndex: 1,
          element: cells.bottomRight,
          aliases: [{ rowId: "row-1", columnId: "column-1" }],
        },
      ],
    });
  } finally {
    restore();
  }
});

test("enhanceTable can programmatically replace the current selections", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    type TestSelection = {
      start: { rowId: string; columnId: string };
      end: { rowId: string; columnId: string };
    };
    const selectionChanges: Array<{ selections: unknown[]; activeSelection: unknown }> = [];
    let setSelectionsFromPlugin: ((selections: TestSelection[], activeSelection?: TestSelection | null) => void) | null = null;
    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      onSelectionChange(selections, activeSelection) {
        selectionChanges.push({ selections, activeSelection });
      },
      plugins: [
        {
          name: "programmatic-selection",
          onSetup(context) {
            setSelectionsFromPlugin = context.setSelections;
          },
        },
      ],
    });
    const columnSelection = {
      start: { rowId: "row-0", columnId: "column-1" },
      end: { rowId: "row-1", columnId: "column-1" },
    };

    assert(setSelectionsFromPlugin);
    setSelectionsFromPlugin([columnSelection]);

    const snapshot = handle.getSelectionSnapshot();

    assert.deepEqual(snapshot.selections, [columnSelection]);
    assert.deepEqual(snapshot.activeSelection, columnSelection);
    assert.deepEqual(snapshot.bounds, [{ minRow: 0, maxRow: 1, minColumn: 1, maxColumn: 1 }]);
    assert.deepEqual(
      snapshot.selectedCells.map((cell) => `${cell.rowId}:${cell.columnId}`),
      ["row-0:column-1", "row-1:column-1"],
    );
    assert.equal(selectionChanges.length, 2);
    assert.deepEqual(selectionChanges.at(-1), {
      selections: [columnSelection],
      activeSelection: columnSelection,
    });

    handle.setSelections([columnSelection], null);

    assert.deepEqual(handle.getSelections(), [columnSelection]);
    assert.equal(handle.getActiveSelection(), null);
    assert.equal(cells.topRight.getAttribute("data-table-steroids-cell"), "true");
  } finally {
    restore();
  }
});

test("enhanceTable selection snapshots preserve rowSpan and colSpan aliases", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createColSpanTableFixture(document);
    const handle = enhanceTable(table, { interactionMode: "desktop", observeMutations: false });

    clickCell(table, cells.spanningCell);

    assert.deepEqual(handle.getSelectionSnapshot(), {
      selections: [{ start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-0", columnId: "column-0" } }],
      activeSelection: { start: { rowId: "row-0", columnId: "column-0" }, end: { rowId: "row-0", columnId: "column-0" } },
      bounds: [{ minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 0 }],
      selectedCells: [
        {
          id: "cell-0-0-0",
          rowId: "row-0",
          columnId: "column-0",
          rowIndex: 0,
          columnIndex: 0,
          element: cells.spanningCell,
          aliases: [
            { rowId: "row-0", columnId: "column-0" },
            { rowId: "row-0", columnId: "column-1" },
          ],
        },
      ],
    });
  } finally {
    restore();
  }
});

test("enhanceTable plugins run in order and can stop built-in key handling", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const seen: string[] = [];
    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      plugins: [
        {
          name: "first",
          onKeyDown(event) {
            seen.push(`first:${event.key}`);
            event.preventDefault();
            return "handled";
          },
        },
        {
          name: "second",
          onKeyDown(event) {
            seen.push(`second:${event.key}`);
          },
        },
      ],
    });

    clickCell(table, cells.topLeft);
    const keyEvent = createKeyboardEvent("keydown", { key: "ArrowRight" });

    cells.topLeft.dispatchEvent(keyEvent);

    assert.equal(keyEvent.defaultPrevented, true);
    assert.deepEqual(seen, ["first:ArrowRight"]);
    assert.deepEqual(handle.getActiveSelection(), {
      start: { rowId: "row-0", columnId: "column-0" },
      end: { rowId: "row-0", columnId: "column-0" },
    });
  } finally {
    restore();
  }
});

test("enhanceTable plugins honor ignored descendants for key events", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const ignoredHandle = document.createElement("div") as FakeHTMLElement;
    let pluginCalls = 0;

    ignoredHandle.setAttribute("data-table-steroids-ignore", "");
    cells.topLeft.appendChild(ignoredHandle);

    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      plugins: [
        {
          name: "delete",
          onKeyDown() {
            pluginCalls += 1;
            return "handled";
          },
        },
      ],
    });

    clickCell(table, cells.topLeft);
    ignoredHandle.dispatchEvent(createKeyboardEvent("keydown", { key: "Delete" }));

    assert.equal(pluginCalls, 0);
    assert.deepEqual(handle.getActiveSelection(), {
      start: { rowId: "row-0", columnId: "column-0" },
      end: { rowId: "row-0", columnId: "column-0" },
    });
  } finally {
    restore();
  }
});

test("enhanceTable plugins can implement delete behavior from the current selection snapshot", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const cleared: string[] = [];
    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      plugins: [
        {
          name: "delete-selection",
          onKeyDown(event, snapshot, context) {
            if (event.key !== "Delete" && event.key !== "Backspace") {
              return;
            }

            event.preventDefault();
            cleared.push(...snapshot.selectedCells.map((cell) => `${cell.rowId}:${cell.columnId}`));
            context.clearSelection();
            return "handled";
          },
        },
      ],
    });

    clickCell(table, cells.bottomRight);
    cells.bottomRight.dispatchEvent(createKeyboardEvent("keydown", { key: "Delete" }));

    assert.equal(cleared.join(","), "row-1:column-1");
    assert.deepEqual(handle.getSelections(), []);
  } finally {
    restore();
  }
});

function getOverlayRoots(document: FakeDocument) {
  const roots = new Map<string, FakeHTMLElement>();
  const walk = (element: FakeElement) => {
    const kind = element.getAttribute("data-table-steroids-overlay");

    if (kind) {
      roots.set(kind, element as FakeHTMLElement);
    }

    element.childNodes.forEach(walk);
  };

  walk(document.body);
  return [roots.get("base"), roots.get("frozen")] as const;
}

function getLayerFill(root: FakeHTMLElement | undefined) {
  const surface = root?.getAttribute("data-table-steroids-overlay") === "frozen" ? root.childNodes[0] : root;
  return surface?.childNodes[0]?.childNodes[0];
}

// A 3-column × 2-row grid whose first column is left-pinned (sticky), so column-0
// is detected as frozen and the overlay splits at the 50px freeze boundary.
function createFrozenGridFixture(document: FakeDocument) {
  const table = document.createElement("table") as FakeHTMLTableElement;
  const tbody = document.createElement("tbody") as FakeHTMLTableSectionElement;
  const firstRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const secondRow = document.createElement("tr") as FakeHTMLTableRowElement;
  const cells = {
    frozenTop: document.createElement("td") as FakeHTMLTableCellElement,
    midTop: document.createElement("td") as FakeHTMLTableCellElement,
    rightTop: document.createElement("td") as FakeHTMLTableCellElement,
    frozenBottom: document.createElement("td") as FakeHTMLTableCellElement,
    midBottom: document.createElement("td") as FakeHTMLTableCellElement,
    rightBottom: document.createElement("td") as FakeHTMLTableCellElement,
  };

  table.setBoundingClientRect({ left: 0, top: 0, right: 150, bottom: 40, width: 150, height: 40 });
  firstRow.setBoundingClientRect({ left: 0, top: 0, right: 150, bottom: 20, width: 150, height: 20 });
  secondRow.setBoundingClientRect({ left: 0, top: 20, right: 150, bottom: 40, width: 150, height: 20 });
  cells.frozenTop.setBoundingClientRect({ left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20 });
  cells.midTop.setBoundingClientRect({ left: 50, top: 0, right: 100, bottom: 20, width: 50, height: 20 });
  cells.rightTop.setBoundingClientRect({ left: 100, top: 0, right: 150, bottom: 20, width: 50, height: 20 });
  cells.frozenBottom.setBoundingClientRect({ left: 0, top: 20, right: 50, bottom: 40, width: 50, height: 20 });
  cells.midBottom.setBoundingClientRect({ left: 50, top: 20, right: 100, bottom: 40, width: 50, height: 20 });
  cells.rightBottom.setBoundingClientRect({ left: 100, top: 20, right: 150, bottom: 40, width: 50, height: 20 });

  // Left-pin the first column.
  [cells.frozenTop, cells.frozenBottom].forEach((cell) => {
    cell.style.position = "sticky";
    cell.style.left = "0px";
  });

  firstRow.append(cells.frozenTop, cells.midTop, cells.rightTop);
  secondRow.append(cells.frozenBottom, cells.midBottom, cells.rightBottom);
  tbody.append(firstRow, secondRow);
  table.append(tbody);
  document.body.appendChild(table);
  document.elementFromPointResolver = (clientX, clientY) => {
    const column = clientX < 50 ? 0 : clientX < 100 ? 1 : 2;
    const row = clientY < 20 ? 0 : 1;
    const grid = [
      [cells.frozenTop, cells.midTop, cells.rightTop],
      [cells.frozenBottom, cells.midBottom, cells.rightBottom],
    ];

    return grid[row][column];
  };

  return { table, cells };
}

test("buildDOMTableModel detects left-pinned columns as frozen", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { buildDOMTableModel } = await import("../dist/dom.js");
    const { table } = createFrozenGridFixture(document);
    const model = buildDOMTableModel(table);

    assert.deepEqual(Array.from(model.frozenColumnIds), ["column-0"]);
    assert.equal(model.columns[0]?.frozen, true);
    assert.equal(model.columns[1]?.frozen, undefined);
    assert.equal(model.columns[2]?.frozen, undefined);
  } finally {
    restore();
  }
});

// The frozen grid inside a horizontally-scrolled overflow container. Column-0 is
// left-pinned, so its cells keep their viewport position while the rest scroll.
function createScrolledFrozenFixture(document: FakeDocument, scrollLeft: number) {
  const scroller = document.createElement("div") as FakeHTMLElement;
  const { table, cells } = createFrozenGridFixture(document);

  table.remove();
  scroller.style.overflow = "auto";
  scroller.setBoundingClientRect({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 });
  scroller.scrollLeft = scrollLeft;
  scroller.scrollWidth = 150;
  scroller.scrollHeight = 40;
  scroller.appendChild(table);
  document.body.appendChild(scroller);

  // Re-pin the frozen column to the scrollport left, shift the scrolling columns.
  const pin = (cell: FakeHTMLTableCellElement, top: number) =>
    cell.setBoundingClientRect({ left: 0, top, right: 50, bottom: top + 20, width: 50, height: 20 });
  const shift = (cell: FakeHTMLTableCellElement, contentLeft: number, top: number) =>
    cell.setBoundingClientRect({
      left: contentLeft - scrollLeft,
      top,
      right: contentLeft + 50 - scrollLeft,
      bottom: top + 20,
      width: 50,
      height: 20,
    });

  pin(cells.frozenTop, 0);
  pin(cells.frozenBottom, 20);
  shift(cells.midTop, 50, 0);
  shift(cells.midBottom, 50, 20);
  shift(cells.rightTop, 100, 0);
  shift(cells.rightBottom, 100, 20);
  table.setBoundingClientRect({ left: -scrollLeft, top: 0, right: 150 - scrollLeft, bottom: 40, width: 150, height: 40 });

  return { scroller, table, cells };
}

test("enhanceTable keeps frozen X aligned before a queued scroll render runs", async () => {
  const { document, window, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { scroller, table, cells } = createScrolledFrozenFixture(document, 30);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    window.setAnimationFrameQueueing(true);
    clickCell(table, cells.frozenTop);
    window.flushAnimationFrames();

    const [baseRoot, frozenRoot] = getOverlayRoots(document);
    const frozenBand = frozenRoot?.childNodes[0];

    assert.equal(frozenRoot?.getAttribute("data-table-steroids-overlay"), "frozen");
    assert.equal(frozenBand?.style.position, "sticky");
    assert.equal(frozenBand?.style.left, "0px");
    assert.equal(frozenBand?.style.width, "50px");
    assert.equal(frozenBand?.style.top ?? "", "");
    assert.equal(getLayerFill(frozenRoot)?.style.left, "0px");
    assert.equal(getLayerFill(frozenRoot)?.style.width, "50px");
    assert.equal(frozenRoot?.style.clipPath ?? "", "");
    // Purely-frozen selection: nothing on the base layer.
    assert.equal(baseRoot?.style.display, "none");

    // The scroll handler queues geometry invalidation, but horizontal correctness
    // already comes from the sticky band and its stable local X coordinates.
    scroller.scrollLeft = 60;
    document.dispatchEvent(new FakeEvent("scroll"));

    assert.equal(window.pendingAnimationFrameCount, 1);
    assert.equal(frozenBand?.style.left, "0px");
    assert.equal(getLayerFill(frozenRoot)?.style.left, "0px");

    window.flushAnimationFrames();
    assert.equal(getLayerFill(getOverlayRoots(document)[1])?.style.left, "0px");
  } finally {
    restore();
  }
});

test("enhanceTable builds two stacked overlay roots with the configured z-indices", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table } = createFrozenGridFixture(document);

    enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      overlay: { zIndex: 13, frozenZIndex: 20 },
    });

    const roots = getOverlayRoots(document);

    assert.equal(roots.length, 2);
    assert.equal(roots[0]?.style.zIndex, "13");
    assert.equal(roots[1]?.style.zIndex, "20");
    assert.equal(roots[0]?.getAttribute("data-table-steroids-overlay"), "base");
    assert.equal(roots[1]?.getAttribute("data-table-steroids-overlay"), "frozen");
  } finally {
    restore();
  }
});

test("enhanceTable paints a purely scrolling selection only on the base layer, clipped to the frozen band", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createFrozenGridFixture(document);

    enhanceTable(table, { interactionMode: "desktop", observeMutations: false });
    clickCell(table, cells.midTop);

    const [baseRoot, frozenRoot] = getOverlayRoots(document);
    const baseFill = getLayerFill(baseRoot);

    // Non-frozen selection: only the base layer paints.
    assert.equal(frozenRoot?.style.display, "none");
    assert.equal(baseFill?.style.left, "50px");
    assert.equal(baseFill?.style.width, "50px");
    // The base layer is left-bounded to the 50px band so it can't paint under the pins.
    assert.equal(baseRoot?.style.clipPath, "inset(0px 874px 728px 50px)");
  } finally {
    restore();
  }
});

test("enhanceTable splits a boundary-spanning selection and suppresses the interior seam edges", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createFrozenGridFixture(document);

    enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      overlay: { selectionStroke: "red" },
    });

    // Select the whole grid, spanning the frozen column and the scrolling columns.
    clickCell(table, cells.frozenTop);
    clickCell(table, cells.rightBottom, { shiftKey: true });

    const [baseRoot, frozenRoot] = getOverlayRoots(document);
    const baseFill = getLayerFill(baseRoot);
    const frozenFill = getLayerFill(frozenRoot);

    assert.ok(baseFill, "expected a scrolling (base) rect");
    assert.ok(frozenFill, "expected a pinned (frozen) rect");

    // Base (scrolling) piece: left seam edge dropped (stroke.left = false).
    assert.equal(baseFill?.style.left, "50px");
    assert.equal(baseFill?.style.width, "100px");
    assert.equal(baseFill?.style.boxShadow, "inset 0 1px 0 0 red, inset -1px 0 0 0 red, inset 0 -1px 0 0 red");

    // Frozen (pinned) piece: right seam edge dropped (stroke.right = false).
    assert.equal(frozenFill?.style.left, "0px");
    assert.equal(frozenFill?.style.width, "50px");
    assert.equal(frozenFill?.style.boxShadow, "inset 0 1px 0 0 red, inset 0 -1px 0 0 red, inset 1px 0 0 0 red");
  } finally {
    restore();
  }
});

function getLayerRing(root: FakeHTMLElement | undefined) {
  const surface = root?.getAttribute("data-table-steroids-overlay") === "frozen" ? root.childNodes[0] : root;
  return surface?.childNodes[1]?.childNodes[0];
}

test("enhanceTable suppresses the copied dashed ring's interior seam edge across the boundary", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createFrozenGridFixture(document);
    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      overlay: { copiedOutline: "blue", copiedOutlineWidth: 2 },
    });

    clickCell(table, cells.frozenTop);
    clickCell(table, cells.rightBottom, { shiftKey: true });
    await handle.copySelection();

    const [baseRoot, frozenRoot] = getOverlayRoots(document);
    const baseRing = getLayerRing(baseRoot);
    const frozenRing = getLayerRing(frozenRoot);

    assert.ok(baseRing, "expected a scrolling (base) copied ring");
    assert.ok(frozenRing, "expected a pinned (frozen) copied ring");

    // The seam sides are dropped; every other side keeps the dashed border.
    assert.equal(baseRing?.style.borderLeft, "0");
    assert.equal(baseRing?.style.borderRight, "2px dashed blue");
    assert.equal(baseRing?.style.borderTop, "2px dashed blue");
    assert.equal(frozenRing?.style.borderRight, "0");
    assert.equal(frozenRing?.style.borderLeft, "2px dashed blue");
    assert.equal(frozenRing?.style.borderTop, "2px dashed blue");
  } finally {
    restore();
  }
});

test("enhanceTable draws the copied ring as a full outline when no columns are frozen", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);
    const handle = enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      overlay: { copiedOutline: "blue", copiedOutlineWidth: 2 },
    });

    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });
    await handle.copySelection();

    const [baseRoot] = getOverlayRoots(document);
    const baseRing = getLayerRing(baseRoot);

    assert.equal(baseRing?.style.outline, "2px dashed blue");
    assert.equal(baseRing?.style.borderLeft ?? "", "");
  } finally {
    restore();
  }
});

test("enhanceTable keeps a single-layer full border when no columns are frozen", async () => {
  const { document, restore } = installFakeDom();

  try {
    const { enhanceTable } = await import("../dist/dom.js");
    const { table, cells } = createGridTableFixture(document);

    enhanceTable(table, {
      interactionMode: "desktop",
      observeMutations: false,
      overlay: { selectionStroke: "red" },
    });
    clickCell(table, cells.topLeft);
    clickCell(table, cells.bottomRight, { shiftKey: true });

    const [baseRoot, frozenRoot] = getOverlayRoots(document);
    const baseFill = getLayerFill(baseRoot);

    // The frozen layer never paints, and the base border is the single full-box shadow.
    assert.equal(frozenRoot?.style.display, "none");
    assert.equal(baseFill?.style.boxShadow, "inset 0 0 0 1px red");
  } finally {
    restore();
  }
});
