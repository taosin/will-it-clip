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
