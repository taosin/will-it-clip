import test from "node:test";
import assert from "node:assert/strict";
import { sessionCounts, availableSlots } from "../src/session.ts";
test("session capacity counts existing entries and never exceeds six", () => {
  assert.equal(availableSlots(0), 6);
  assert.equal(availableSlots(5), 1);
  assert.equal(availableSlots(6), 0);
});
test("unread and cancelled images are not successful scans or reviewed findings", () => {
  assert.deepEqual(
    sessionCounts([
      { phase: "ready", decisions: ["Unreviewed"] },
      { phase: "cancelled", decisions: [] },
      {
        phase: "complete",
        decisions: ["Confirmed", "Expected behavior", "Unreviewed"],
      },
      { phase: "error", decisions: [] },
    ]),
    { success: 1, failed: 1, unread: 1, cancelled: 1, reviewed: 2, pending: 2 },
  );
});
