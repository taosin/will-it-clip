import type { ScanLine } from "./ocr";
import type { Region } from "./region";

function normalized(text: string) {
  return text
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\s*(?:\.{3}|…)$/u, "…");
}

export function hasTrailingEllipsis(text: string) {
  const value = normalized(text);
  return value.endsWith("…") && /\p{L}/u.test(value);
}

export function compareText(
  observed: string,
  expected: string,
): "complete" | "shortened" | "unknown" {
  const actual = normalized(observed);
  const full = normalized(expected);
  if (actual && actual === full) return "complete";
  if (!hasTrailingEllipsis(actual)) return "unknown";
  const prefix = actual.slice(0, -1).trimEnd();
  return full.startsWith(prefix) &&
    /[\p{L}\p{N}]/u.test(full.slice(prefix.length))
    ? "shortened"
    : "unknown";
}

// Only clear a full-image finding when both scans read the same label in the
// same position. A matching neighboring control cannot clear this finding.
export function matchedCandidate(
  candidates: { i: number; line: ScanLine }[],
  region: Region,
  local: ScanLine[],
): number | null {
  const inside = candidates.filter(
    ({ line: { bbox: b } }) =>
      b.x0 >= region.x &&
      b.y0 >= region.y &&
      b.x1 <= region.x + region.width &&
      b.y1 <= region.y + region.height,
  );
  if (inside.length !== 1) return null;
  const { line, i } = inside[0];
  const a = line.bbox;
  const matches = local.filter(({ bbox: b, text }) => {
    if (compareText(line.text, text) !== "complete") return false;
    const intersection =
      Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
      Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const union =
      (a.x1 - a.x0) * (a.y1 - a.y0) +
      (b.x1 - b.x0) * (b.y1 - b.y0) -
      intersection;
    return union > 0 && intersection / union >= 0.5;
  });
  return matches.length === 1 ? i : null;
}
