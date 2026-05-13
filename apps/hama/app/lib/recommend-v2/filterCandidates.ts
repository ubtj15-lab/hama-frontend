import type { HomeCard } from "@/lib/storeTypes";
import { evaluateBeautyStrictWhitelist, evaluateCultureStrictWhitelist } from "@/lib/hamaResultCategoryCanonical";
import type { RecommendVertical } from "./normalizeRequest";
import { getVerticalRules, verticalUsesStrictWhitelist } from "./verticalRules";

export type FilterCandidatesV2Options = {
  /** culture URL 또는 activity_general+문화계열 쿼리 — 식당·카페 등 제거 */
  cultureStrict?: boolean;
};

export type FilterExample = {
  name: string;
  category: string | null;
  categoryLabel: string | null;
  reason: string;
};

export type FilterCandidatesV2Result = {
  filtered: HomeCard[];
  rejectedExamples: FilterExample[];
  acceptedExamples: FilterExample[];
};

function cardBlob(card: HomeCard): string {
  const tags = Array.isArray(card.tags) ? card.tags.join(" ") : String(card.tags ?? "");
  return `${card.name ?? ""} ${tags} ${String(card.categoryLabel ?? "")} ${String((card as { description?: string | null }).description ?? "")}`
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function rawCategory(card: HomeCard): string {
  return String(card.category ?? "").trim().toLowerCase();
}

function hasKeyword(blob: string, kw: string): boolean {
  return blob.includes(kw.toLowerCase());
}

function hasAllowCategory(code: string, allow: readonly string[]): boolean {
  if (!code) return false;
  if (allow.some((a) => code === a.toLowerCase())) return true;
  return allow.some((a) => a && code.includes(a.toLowerCase()));
}

export function filterCandidatesV2(
  vertical: RecommendVertical,
  cards: HomeCard[],
  options?: FilterCandidatesV2Options
): FilterCandidatesV2Result {
  const rules = getVerticalRules(vertical);
  const strict = verticalUsesStrictWhitelist(vertical);
  const rejectedExamples: FilterExample[] = [];
  const acceptedExamples: FilterExample[] = [];

  const pushRej = (card: HomeCard, reason: string) => {
    if (rejectedExamples.length >= 40) return;
    rejectedExamples.push({
      name: String(card.name ?? ""),
      category: card.category ?? null,
      categoryLabel: card.categoryLabel ?? null,
      reason,
    });
  };

  const pushAcc = (card: HomeCard, reason: string) => {
    if (acceptedExamples.length >= 40) return;
    acceptedExamples.push({
      name: String(card.name ?? ""),
      category: card.category ?? null,
      categoryLabel: card.categoryLabel ?? null,
      reason,
    });
  };

  const filtered: HomeCard[] = [];
  let beautyRejectLogCount = 0;
  let cultureRejectLogCount = 0;
  const cultureStrict = options?.cultureStrict === true;

  for (const card of cards) {
    const blob = cardBlob(card);
    const cat = rawCategory(card);
    const label = String(card.categoryLabel ?? "").toLowerCase();

    if (vertical === "all") {
      filtered.push(card);
      pushAcc(card, "all_pass_through");
      continue;
    }

    if (vertical === "beauty") {
      const ev = evaluateBeautyStrictWhitelist(card);
      if (!ev.ok) {
        pushRej(card, ev.reason);
        if (beautyRejectLogCount < 40) {
          beautyRejectLogCount += 1;
          console.log("[HAMA_BEAUTY_REJECT_REASON]", {
            name: String(card.name ?? ""),
            category: card.category ?? null,
            categoryLabel: card.categoryLabel ?? null,
            rejectReason: ev.reason,
          });
        }
        continue;
      }
      filtered.push(card);
      pushAcc(card, ev.passKind === "A" ? "beauty_strict_A" : "beauty_strict_B");
      continue;
    }

    if (cultureStrict) {
      const ev = evaluateCultureStrictWhitelist(card);
      if (!ev.ok) {
        pushRej(card, ev.reason);
        if (cultureRejectLogCount < 40) {
          cultureRejectLogCount += 1;
          console.log("[HAMA_CULTURE_REJECT_REASON]", {
            name: String(card.name ?? ""),
            category: card.category ?? null,
            categoryLabel: card.categoryLabel ?? null,
            rejectReason: ev.reason,
          });
        }
        continue;
      }
      filtered.push(card);
      pushAcc(card, ev.passKind === "A" ? "culture_strict_A" : "culture_strict_B");
      continue;
    }

    const blocked = rules.blockKeywords.find((kw) => hasKeyword(blob, kw) || hasKeyword(label, kw));
    if (blocked) {
      pushRej(card, `blocked_${blocked}`);
      continue;
    }

    if (strict) {
      const codeHit = hasAllowCategory(cat, rules.allowCategoryCodes);
      const kwHit =
        rules.allowKeywords.some((kw) => hasKeyword(blob, kw) || hasKeyword(label, kw)) ||
        rules.allowKeywords.some((kw) => hasKeyword(cat, kw));
      if (!codeHit && !kwHit) {
        pushRej(card, "no_allow_match");
        continue;
      }
      filtered.push(card);
      pushAcc(card, codeHit ? "allow_category" : "allow_keyword");
      continue;
    }

    // restaurant / cafe / activity: 차단 우선, 허용 코드 또는 허용 키워드 중 하나
    const codeHit = hasAllowCategory(cat, rules.allowCategoryCodes);
    const kwHit = rules.allowKeywords.some((kw) => hasKeyword(blob, kw) || hasKeyword(label, kw));
    if (rules.allowCategoryCodes.length === 0 && rules.allowKeywords.length === 0) {
      filtered.push(card);
      pushAcc(card, "no_rules_pass");
    } else if (codeHit || kwHit) {
      filtered.push(card);
      pushAcc(card, codeHit ? "allow_category" : "allow_keyword");
    } else {
      pushRej(card, "no_allow_match");
    }
  }

  return { filtered, rejectedExamples, acceptedExamples };
}
