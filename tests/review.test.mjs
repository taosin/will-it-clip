import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTrailingEllipsis, compareText } from "../src/review.ts";

test("a menu icon and a decimal number do not count as truncated words", () => {
  for (const text of ["…", "...", "Menu ⋯", "1.23", "Loading"]) {
    assert.equal(hasTrailingEllipsis(text), false);
  }
  assert.equal(hasTrailingEllipsis("Überprüfe deinen Po…"), true);
});

test("the expected copy distinguishes intentional punctuation from a missing suffix", () => {
  assert.equal(compareText("Loading...", "Loading…"), "complete");
  assert.equal(
    compareText("Überprüfe deinen Po…", "Überprüfe deinen Posteingang"),
    "shortened",
  );
  assert.equal(
    compareText(
      "Überprüfe deinen\nPosteingang",
      "U\u0308berprüfe deinen Posteingang",
    ),
    "complete",
  );
  assert.equal(
    compareText("Loading...", "Überprüfe deinen Posteingang"),
    "unknown",
  );
  assert.equal(
    compareText("Überprufe deinen Po…", "Überprüfe deinen Posteingang"),
    "unknown",
  );
});

test("a shortened label identifies the missing part of the supplied copy", async () => {
  const { compareLabel } = await import("../src/review.ts");
  assert.deepEqual(
    compareLabel("Überprüfe deinen Po…", "U\u0308berprüfe deinen\nPosteingang"),
    { verdict: "shortened", missing: "steingang" },
  );
  assert.deepEqual(compareLabel("Open ...", "Open   résumé (2)..."), {
    verdict: "shortened",
    missing: " résumé (2)...",
  });
  for (const [observed, expected, verdict] of [
    ["Loading...", "Loading…", "complete"],
    ["Über...", "überall", "unknown"],
    ["Über", "Überall", "unknown"],
    ["Über…", "Über!", "unknown"],
    ["…", "Menu", "unknown"],
  ]) {
    assert.deepEqual(compareLabel(observed, expected), { verdict });
  }
});

test("a region match cannot clear a different label in the same area", async () => {
  const { matchedCandidate } = await import("../src/review.ts");
  const rect = { x: 0, y: 0, width: 120, height: 70 };
  const first = {
    text: "Loading...",
    confidence: 93,
    bbox: { x0: 5, y0: 5, x1: 75, y1: 20 },
  };
  const second = { ...first, bbox: { x0: 5, y0: 40, x1: 75, y1: 55 } };
  const tied = [{ i: 7, line: first }];
  assert.equal(
    matchedCandidate(tied, rect, [{ ...first, text: "Loading…" }]),
    7,
  );
  assert.equal(matchedCandidate(tied, rect, [second]), null);
  assert.equal(
    matchedCandidate(tied, rect, [{ ...first, text: "Finished" }]),
    null,
  );
  assert.equal(
    matchedCandidate([...tied, { i: 8, line: second }], rect, [first]),
    null,
  );
});
