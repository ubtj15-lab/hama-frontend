/**
 * HAMA diagnostic `console.log` — no-op when `NODE_ENV === "production"` (e.g. `next build`).
 * Use for open-beta debug tags only; keep `console.error` for real failures.
 */
export function hamaDevLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console -- dev-only diagnostics
  console.log(...args);
}
