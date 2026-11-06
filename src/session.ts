export const availableSlots = (count: number) => Math.max(0, 6 - count);
export function sessionCounts(
  entries: { phase: string; decisions: string[] }[],
) {
  return {
    success: entries.filter((e) => e.phase === "complete").length,
    failed: entries.filter((e) => e.phase === "error").length,
    unread: entries.filter((e) => e.phase === "ready").length,
    cancelled: entries.filter((e) => e.phase === "cancelled").length,
    reviewed: entries
      .flatMap((e) => e.decisions)
      .filter((d) => d !== "Unreviewed").length,
    pending: entries
      .flatMap((e) => e.decisions)
      .filter((d) => d === "Unreviewed").length,
  };
}
