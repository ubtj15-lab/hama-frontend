import type { HomeCard } from "@/lib/storeTypes";
import type { ScoredRecommendItem } from "@/lib/recommend/scoring";
import { hamaDevLog } from "@/lib/hamaDevLog";

type ReasonScenario = "kids" | "culture" | "date" | "rainy" | "general";
type ReasonTheme = string;

const RECENT_REASON_KEY = "hama_recent_reason_phrases";
const QUERY_REASON_NONCE_KEY = "hama_reason_query_nonce_v1";

const reasonTemplates: Record<ReasonScenario, Record<ReasonTheme, string[]>> = {
  kids: {
    safety: ["아이와 함께 머물기 비교적 편한 분위기예요", "가족 동선으로 들르기 무리 없는 편이에요"],
    indoor: ["실내 위주로 이용하기 좋아 날씨 변수에 덜 민감해요", "실내에서 시간을 보내기 수월한 후보예요"],
    activity: ["직접 즐길 요소가 있어 아이가 지루하지 않아요", "가볍게 체험하기 좋은 포인트가 있어요"],
    comfort: ["잠깐 쉬어가기에도 부담이 적어요", "이동-체류 흐름이 부드러운 편이에요"],
  },
  culture: {
    quiet: ["조용히 둘러보며 분위기 전환하기 좋아요", "차분하게 머물기 좋은 결의 장소예요"],
    inspiration: ["전시/문화 무드로 가볍게 영감 받기 좋아요", "문화생활 톤과 맞는 감상 포인트가 있어요"],
    indoor: ["실내 중심으로 즐기기 좋아요", "날씨 영향이 적어 일정이 안정적이에요"],
    flow: ["짧게 들렀다가 다음 동선으로 이어가기 편해요", "가볍게 둘러보기 좋은 밀도의 후보예요"],
  },
  date: {
    mood: ["분위기 있게 대화 이어가기 좋은 편이에요", "데이트 무드가 자연스럽게 살아나는 장소예요"],
    photo: ["사진 남기기 좋은 포인트가 있는 편이에요", "기록 남기기 좋은 감성 톤이에요"],
    conversation: ["오래 앉아 이야기 나누기 좋아요", "동선 부담이 적어 편하게 머물 수 있어요"],
    flow: ["근처 코스와 이어가기 좋은 선택지예요", "짧게 들렀다가 다음 코스로 넘어가기 편해요"],
  },
  rainy: {
    indoor: ["실내에서 즐기기 좋아 비 오는 날에도 안정적이에요", "날씨 영향 없이 머물기 좋은 타입이에요"],
    accessibility: ["접근 동선이 단순해 이동 부담이 적어요", "우천 상황에서도 비교적 들르기 편해요"],
    cozy: ["오래 머물기 편한 분위기예요", "잠깐 피신해 쉬어가기에도 괜찮아요"],
  },
  general: {
    proximity: ["이동 부담이 적은 거리예요", "가볍게 들르기 좋은 위치예요"],
    category: ["이 상황에서 무난하게 선택하기 좋은 유형이에요", "현재 의도와 맞는 카테고리 후보예요"],
  },
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normQuery(q: string | null | undefined): string {
  return String(q ?? "").trim().toLowerCase();
}

function blob(card: HomeCard): string {
  const c = card as any;
  const parts = [
    String(c?.name ?? ""),
    String(c?.category ?? ""),
    String(c?.description ?? ""),
    Array.isArray(c?.tags) ? c.tags.join(" ") : String(c?.tags ?? ""),
    Array.isArray(c?.mood) ? c.mood.join(" ") : String(c?.mood ?? ""),
    String(c?.moodText ?? ""),
  ];
  return ` ${parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

function inferScenario(query: string, text: string): ReasonScenario {
  if (includesAny(query, ["아이", "아이랑", "가족", "키즈"]) || includesAny(text, ["키즈", "아이동반"])) return "kids";
  if (includesAny(query, ["문화생활", "문화", "박물관", "전시", "도서관"])) return "culture";
  if (includesAny(query, ["데이트", "연인", "커플"])) return "date";
  if (includesAny(query, ["비오는날", "비", "실내"])) return "rainy";
  return "general";
}

function getQueryNonce(query: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(QUERY_REASON_NONCE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const next = (map[query] ?? 0) + 1;
    map[query] = next;
    window.sessionStorage.setItem(QUERY_REASON_NONCE_KEY, JSON.stringify(map));
    return next;
  } catch {
    return 0;
  }
}

function readRecentReasons(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_REASON_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeRecentReasons(next: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RECENT_REASON_KEY, JSON.stringify(next.slice(-30)));
  } catch {}
}

function staticSignals(card: HomeCard): string[] {
  const c = card as any;
  const out: string[] = [];
  const b = blob(card);
  if (typeof c.distanceKm === "number" && c.distanceKm <= 1.3) out.push("이동 부담이 적어요");
  if (includesAny(b, ["실내", "indoor"])) out.push("날씨 영향 없이 즐기기 좋아요");
  if (includesAny(b, ["카페", "커피", "디저트"])) out.push("잠깐 쉬어가기 좋아요");
  if (includesAny(b, ["activity", "체험", "놀이", "보드게임"])) out.push("직접 즐길 요소가 있어요");
  if (includesAny(b, ["도서관", "박물관", "미술관", "전시"])) out.push("조용히 둘러보기 좋아요");
  return out;
}

export function applyReasonTemplateEngine(params: {
  items: ScoredRecommendItem[];
  query: string | null | undefined;
}): ScoredRecommendItem[] {
  const { items } = params;
  const query = normQuery(params.query);
  if (items.length === 0) return items;
  const nonce = getQueryNonce(query);
  const recent = readRecentReasons();
  const recentSet = new Set(recent);
  const deckUsed = new Set<string>();
  const usedPatternsByCard = new Set<string>();
  const emitted: string[] = [];

  const updated = items.map((item, idx) => {
    const cardText = blob(item.card);
    const scenario = inferScenario(query, cardText);
    const packs = reasonTemplates[scenario] ?? reasonTemplates.general;
    const candidates: { phrase: string; source: string; score: number }[] = [];

    for (const [theme, phrases] of Object.entries(packs)) {
      for (let i = 0; i < phrases.length; i += 1) {
        const phrase = phrases[i]!;
        const key = `${theme}:${phrase}`;
        const h = hashString(`${query}|${item.card.id}|${nonce}|${theme}|${i}`) % 1000;
        let score = 1000 - h;
        if (recentSet.has(phrase)) score -= 180;
        if (deckUsed.has(phrase)) score -= 140;
        if (usedPatternsByCard.has(key)) score -= 80;
        candidates.push({ phrase, source: `${scenario}:${theme}`, score });
      }
    }

    for (const s of staticSignals(item.card)) {
      candidates.push({
        phrase: s,
        source: "signal:place",
        score: 500 - (hashString(`${query}|${item.card.id}|${s}|${idx}`) % 100),
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const picked: string[] = [];
    let reasonSource = "template";
    for (const c of candidates) {
      if (picked.length >= 3) break;
      if (picked.includes(c.phrase)) continue;
      if (deckUsed.has(c.phrase)) continue;
      picked.push(c.phrase);
      reasonSource = c.source;
      deckUsed.add(c.phrase);
      usedPatternsByCard.add(c.source);
    }

    if (picked.length === 0 && item.reasonText) {
      picked.push(item.reasonText);
      reasonSource = "legacy";
    }
    if (picked.length === 0) {
      picked.push("영업 정보는 방문 전 확인해 주세요");
      reasonSource = "safe_fallback";
    }

    emitted.push(...picked);
    const reasonText = picked.slice(0, 3).join(" · ");
    hamaDevLog("[HAMA_REASON_ENGINE]", {
      query,
      category: item.card.category ?? null,
      selectedReasons: picked,
      reasonSource,
    });
    return {
      ...item,
      reasonText,
      card: { ...item.card, reasonText },
    };
  });

  writeRecentReasons([...recent, ...emitted]);
  return updated;
}

