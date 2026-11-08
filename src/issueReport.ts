import type { HumanDecision } from "./annotation";

function quoteLabel(value: string, empty: string) {
  if (!value.trim()) return empty;
  // Indent every line so labels containing Markdown stay literal on GitHub.
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => "    " + line)
    .join("\n");
}

export function formatIssueReport({
  expected,
  recognized,
  missing,
  machine,
  decision,
}: {
  expected: string;
  recognized: string;
  missing?: string;
  machine: string;
  decision: HumanDecision;
}) {
  const sections = [
    "### Screenshot text review",
    "**Expected text**",
    quoteLabel(expected, "No expected text entered."),
    "**Recognized text (OCR)**",
    quoteLabel(recognized, "No text recognized."),
  ];
  if (missing) sections.push("**Missing ending**", quoteLabel(missing, ""));
  sections.push(
    "**Machine evidence**",
    machine,
    "**Human decision**",
    decision === "Confirmed" ? "Clipping confirmed." : decision + ".",
  );
  return sections.join("\n\n");
}
