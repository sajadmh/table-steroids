import assert from "node:assert/strict";
import test from "node:test";

import { resolveInteractionMode } from "../dist/dom.js";

test("resolveInteractionMode keeps explicit desktop and touch overrides", () => {
  assert.equal(resolveInteractionMode("desktop", { maxTouchPoints: 5 }), "desktop");
  assert.equal(resolveInteractionMode("touch", { maxTouchPoints: 0 }), "touch");
});

test("resolveInteractionMode defaults to touch for coarse-pointer environments", () => {
  const mode = resolveInteractionMode("auto", {
    matchMedia(query) {
      return {
        matches: query === "(pointer: coarse)" || query === "(hover: none)",
      };
    },
    maxTouchPoints: 1,
  });

  assert.equal(mode, "touch");
});

test("resolveInteractionMode defaults to desktop for fine-pointer environments", () => {
  const mode = resolveInteractionMode("auto", {
    matchMedia() {
      return {
        matches: false,
      };
    },
    maxTouchPoints: 0,
  });

  assert.equal(mode, "desktop");
});
