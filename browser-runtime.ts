import { enhanceTable, enhanceTables, type EnhanceTablesOptions, type TableSpreadsheetCollectionHandle } from "./dom/enhance-table.js";
import { buildDOMTableModel, getCoordinateKey } from "./dom/table-model.js";
import { DEFAULT_OVERLAY_THEME } from "./dom/overlay.js";

const API_GLOBAL_KEY = "TableSteroids";
const PAGE_HANDLE_GLOBAL_KEY = "__tableSteroidsPageHandle__";

interface BrowserTableSteroidsApi {
  enhanceTable: typeof enhanceTable;
  enhanceTables: typeof enhanceTables;
  buildDOMTableModel: typeof buildDOMTableModel;
  getCoordinateKey: typeof getCoordinateKey;
  DEFAULT_OVERLAY_THEME: typeof DEFAULT_OVERLAY_THEME;
  enablePage(options?: EnhanceTablesOptions): TableSpreadsheetCollectionHandle | null;
  disablePage(): void;
  togglePage(options?: EnhanceTablesOptions): TableSpreadsheetCollectionHandle | null;
}

type BrowserGlobal = typeof globalThis & {
  TableSteroids?: BrowserTableSteroidsApi;
  __tableSteroidsPageHandle__?: TableSpreadsheetCollectionHandle;
};

function getBrowserGlobal() {
  return globalThis as BrowserGlobal;
}

function enablePage(options: EnhanceTablesOptions = {}) {
  if (typeof document === "undefined") {
    return null;
  }

  const browserGlobal = getBrowserGlobal();
  browserGlobal[PAGE_HANDLE_GLOBAL_KEY]?.destroy();
  const handle = enhanceTables(document, {
    ...options,
    interactionMode: "desktop",
  });
  browserGlobal[PAGE_HANDLE_GLOBAL_KEY] = handle;
  return handle;
}

function disablePage() {
  const browserGlobal = getBrowserGlobal();
  const existingHandle = browserGlobal[PAGE_HANDLE_GLOBAL_KEY];

  if (!existingHandle) {
    return;
  }

  existingHandle.destroy();
  delete browserGlobal[PAGE_HANDLE_GLOBAL_KEY];
}

function togglePage(options: EnhanceTablesOptions = {}) {
  const browserGlobal = getBrowserGlobal();

  if (browserGlobal[PAGE_HANDLE_GLOBAL_KEY]) {
    disablePage();
    return null;
  }

  return enablePage(options);
}

if (typeof window !== "undefined") {
  const api = {
    enhanceTable,
    enhanceTables,
    buildDOMTableModel,
    getCoordinateKey,
    DEFAULT_OVERLAY_THEME,
    enablePage,
    disablePage,
    togglePage,
  };

  getBrowserGlobal()[API_GLOBAL_KEY] = api;
}
