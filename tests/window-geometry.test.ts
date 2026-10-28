import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resizeRect,
  constrainRect,
  windowMinimums,
} from "../src/lib/window-geometry";
const rect = { x: 200, y: 150, width: 700, height: 450 };
const viewport = { width: 1440, height: 900 };
test("west and north resizing preserve the opposite edges", () => {
  const result = resizeRect(rect, "nw", -50, -50, viewport);
  assert.deepEqual(result, { x: 150, y: 100, width: 750, height: 500 });
  assert.equal(result.x + result.width, rect.x + rect.width);
  assert.equal(result.y + result.height, rect.y + rect.height);
});
test("minimum size and workspace bounds survive extreme drags", () => {
  assert.deepEqual(resizeRect(rect, "se", -5000, -5000, viewport), {
    ...rect,
    width: 480,
    height: 330,
  });
  const expanded = resizeRect(rect, "se", 5000, 5000, viewport);
  assert.equal(expanded.x + expanded.width, viewport.width - 12);
  assert.equal(expanded.y + expanded.height, viewport.height - 96);
  const north = resizeRect(rect, "nw", -5000, -5000, viewport);
  assert.equal(north.x, 12);
  assert.equal(north.y, 44);
});

test("each app keeps its minimum size from every resize edge", () => {
  for (const minimum of Object.values(windowMinimums)) {
    for (const edge of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
      const start = { x: 100, y: 80, width: 900, height: 650 };
      const result = resizeRect(
        start,
        edge,
        edge.includes("w") ? 5000 : -5000,
        edge.includes("n") ? 5000 : -5000,
        viewport,
        minimum,
      );
      assert.ok(result.width >= minimum.width, edge + " width");
      assert.ok(result.height >= minimum.height, edge + " height");
    }
  }
});
test("old undersized windows and narrow browser sizes cannot bypass app minimums", () => {
  const minimum = windowMinimums.settings;
  const restored = constrainRect(
    { x: 1200, y: 800, width: 200, height: 150 },
    viewport,
    minimum,
  );
  assert.equal(restored.width, minimum.width);
  assert.equal(restored.height, minimum.height);
  assert.ok(restored.x + restored.width <= viewport.width);
  const small = constrainRect(restored, { width: 400, height: 300 }, minimum);
  assert.equal(small.width, minimum.width);
  assert.equal(small.height, minimum.height);
  assert.equal(small.x, 0);
  assert.equal(small.y, 42);
});
