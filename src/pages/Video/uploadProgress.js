// Count committed bytes and only the current retry attempt, never previous attempts.
export function progressBytes(committed, attempt, total, finalized = false) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (finalized) return total;
  return Math.max(0, Math.min(total - 1, committed + attempt));
}
