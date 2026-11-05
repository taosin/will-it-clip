import { test } from "node:test";
import assert from "node:assert/strict";
import { cropGeometry } from "../src/region.ts";

test("padding at the screenshot edge preserves original pixel coordinates", () => {
  const crop = cropGeometry(
    { x: 1.2, y: -12, width: 45.1, height: 50 },
    100,
    100,
  );
  assert.deepEqual(crop, {
    x: 0,
    y: 0,
    w: 53,
    h: 44,
    outputWidth: 106,
    outputHeight: 88,
    left: 1,
    top: 0,
    right: 47,
    bottom: 38,
  });
});

test("a full-image selection respects the memory and canvas side limits", () => {
  const crop = cropGeometry(
    { x: 0, y: 0, width: 3000, height: 2000 },
    3000,
    2000,
  );
  assert.equal(crop.outputWidth * crop.outputHeight, 6_000_000);
  const thin = cropGeometry(
    { x: 0, y: 0, width: 8000, height: 250 },
    8000,
    250,
  );
  assert.ok(thin.outputWidth <= 8192);
});

test("an off-image or accidental short drag cannot start a region scan", () => {
  for (const area of [
    { x: 100, y: 100, width: 20, height: 30 },
    { x: 2, y: 2, width: 1, height: 80 },
    { x: NaN, y: 4, width: 30, height: 30 },
  ])
    assert.throws(() => cropGeometry(area, 100, 100));
});
