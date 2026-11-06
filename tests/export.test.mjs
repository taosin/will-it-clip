import { test } from "node:test";
import assert from "node:assert/strict";
import { exportGeometry, wrapAnnotation } from "../src/annotation.ts";

test("context crop includes margin, clamps edges and bounds large exports", () => {
  const g = exportGeometry(
    { x: 0, y: 20, width: 80, height: 30 },
    400,
    300,
    false,
  );
  assert.deepEqual(g.crop, { x: 0, y: 0, width: 104, height: 74 });
  assert.ok(g.width >= 560);
  const huge = exportGeometry(
    { x: 100, y: 100, width: 8000, height: 8000 },
    8192,
    8192,
    true,
  );
  assert.ok(huge.imageWidth <= 1400 && huge.imageHeight <= 1400);
  assert.deepEqual(huge.crop, { x: 0, y: 0, width: 8192, height: 8192 });
  assert.throws(() =>
    exportGeometry({ x: NaN, y: 0, width: 5, height: 10 }, 100, 100, false),
  );
  assert.throws(() =>
    exportGeometry({ x: 200, y: 0, width: 5, height: 10 }, 100, 100, false),
  );
});

test("annotation wraps long tokens, preserves paragraphs and marks truncation", () => {
  const measure = (text) => [...text].length * 10;
  assert.deepEqual(wrapAnnotation("abc def\nxyz", 40, measure), [
    "abc",
    "def",
    "xyz",
  ]);
  const lines = wrapAnnotation("😀".repeat(1000), 40, measure, 4);
  assert.equal(lines.length, 4);
  assert.ok(lines.at(-1).includes("…"));
  assert.ok(lines.every((line) => measure(line) <= 40));
  assert.equal(
    wrapAnnotation("<script>alert(1)</script>", 400, measure).join(""),
    "<script>alert(1)</script>",
  );
});
