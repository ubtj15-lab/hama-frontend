import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

/**
 * Explicit place tokens that exist as address or store-name text.
 * Longer tokens are matched first. "동탄" also covers 동탄역 and 동탄2
 * because those strings contain 동탄. The loose area tag column is not used:
 * it lists several cities on one store.
 */
const REGION_TOKENS = ["동탄역", "동탄1", "동탄2", "북광장", "동탄", "오산", "평택", "병점"] as const;

const AMBIGUOUS_PROMPTS: { pattern: RegExp; prompt: string }[] = [
  {
    pattern: /화성/,
    prompt: "화성은 동탄과 병점이 함께 있어요. 동탄, 병점, 오산 중 어디를 볼까요?",
  },
  {
    pattern: /호수/,
    prompt: "호수는 여러 공원에 있어요. 동탄호수인지 알려 주세요.",
  },
];

export function namedAreaFromUtterance(text: string): string | null {
  const raw = String(text ?? "");
  for (const token of REGION_TOKENS) {
    if (raw.includes(token)) return token;
  }
  return null;
}

export function regionClarificationFor(text: string): string | null {
  if (namedAreaFromUtterance(text)) return null;
  const raw = String(text ?? "");
  for (const item of AMBIGUOUS_PROMPTS) {
    if (item.pattern.test(raw)) return item.prompt;
  }
  return null;
}

export function withNamedRegion(
  intent: ScenarioObject,
  text: string,
  previousRegion?: string | null
): ScenarioObject {
  const named = namedAreaFromUtterance(text);
  if (named) return { ...intent, region: named };
  if (!intent.region && previousRegion) return { ...intent, region: previousRegion };
  return intent;
}

export function cardMatchesNamedRegion(
  card: Pick<HomeCard, "name" | "address">,
  region: string
): boolean {
  const token = String(region ?? "").trim();
  const address = String(card.address ?? "").trim();
  if (!token || !address) return false;
  const postal = /시|군|구|읍|면|로|길/.test(address) || /[가-힣]동(?!탄)/.test(address);
  if (!postal) return false;
  if (token === "오산") return /(?<!동탄)오산(?!동)/.test(address);
  return address.includes(token);
}

/** Candidate-stage filter. Does not add stores from outside the named area. */
export function candidatesForNamedRegion<T extends Pick<HomeCard, "name" | "address">>(
  cards: readonly T[],
  region: string | null | undefined
): T[] {
  const name = String(region ?? "").trim();
  if (!name) return [...cards];
  return cards.filter((card) => cardMatchesNamedRegion(card, name));
}

export function filterCardsByNamedRegion<T extends Pick<HomeCard, "name" | "address">>(
  cards: readonly T[],
  region: string | null | undefined
): T[] {
  return candidatesForNamedRegion(cards, region);
}
