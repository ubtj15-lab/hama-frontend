/**
 * Distinguishes a completed recommendation query from a query that never returned.
 * Scoring and rank order are decided later, from the cards this module keeps.
 */

export type CardFetch<T> = { status: "ok"; cards: T[] } | { status: "failed" };

export type RecommendationPresentation<T> =
  | { kind: "cards"; cards: T[] }
  | { kind: "empty" }
  | { kind: "fetch_failed" }
  | { kind: "suppression_blocked" };

type HttpCardBody = { items?: unknown; error?: unknown } | null;

/** HTTP 200 with an items array is a completed query, including an empty array. */
export function readHttpCardBody(input: { ok: boolean; body: HttpCardBody }): CardFetch<unknown> {
  if (!input.ok || !input.body || typeof input.body !== "object") return { status: "failed" };
  if (input.body.error) return { status: "failed" };
  if (!Array.isArray(input.body.items)) return { status: "failed" };
  return { status: "ok", cards: input.body.items };
}

/**
 * Primary queries are the catalog reads that define the pool.
 * Auxiliary queries may fail without discarding cards a primary query already returned.
 * A primary failure is not shown as an empty success unless some completed query produced cards.
 * Suppression failure always blocks, including when the fetch itself succeeded.
 */
export function presentRecommendation<T>(input: {
  primaryFailures: number;
  primarySuccesses: number;
  cards: T[];
  suppression: "ok" | "failed";
}): RecommendationPresentation<T> {
  if (input.suppression === "failed") return { kind: "suppression_blocked" };
  if (input.cards.length > 0) return { kind: "cards", cards: input.cards };
  if (input.primaryFailures > 0 && input.primarySuccesses === 0) return { kind: "fetch_failed" };
  return { kind: "empty" };
}
