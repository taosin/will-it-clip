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
