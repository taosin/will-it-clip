import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIssueReport } from "../src/issueReport.ts";

const review = {
  expected: "Posteingang",
  recognized: "Po…",
  missing: "steingang",
  machine: "Text comparison: shortened.",
  decision: "Unreviewed",
};

test("copying a report keeps OCR evidence and the human decision separate", () => {
  const draft = formatIssueReport(review);
  assert.match(draft, /\*\*Expected text\*\*\n\n    Posteingang/);
  assert.match(draft, /\*\*Recognized text \(OCR\)\*\*\n\n    Po…/);
  assert.match(draft, /\*\*Missing ending\*\*\n\n    steingang/);
  assert.match(draft, /Text comparison: shortened\./);
  assert.match(draft, /Human decision\*\*\n\nUnreviewed\./);
  const manual = formatIssueReport({
    ...review,
    recognized: "",
    missing: undefined,
    machine: "Area OCR failed.",
    decision: "Confirmed",
  });
  assert.match(manual, /No text recognized\./);
  assert.match(manual, /Clipping confirmed\./);
  assert.doesNotMatch(manual, /Missing ending/);
});

test("multiline screenshot text stays literal when the report is pasted into GitHub", () => {
  const label = "Start\r\n\r\n@mention\r\n```\r<img src=x>";
  const draft = formatIssueReport({ ...review, expected: label, recognized: label, missing: label });
  const quoted = "    Start\n    \n    @mention\n    ```\n    <img src=x>";
  assert.equal(draft.split(quoted).length - 1, 3);
  assert.doesNotMatch(draft, /^(@mention|<img)/m);
});
