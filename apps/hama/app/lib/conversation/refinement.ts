import type { ConversationContext } from "./types";
import type { RefinementType } from "./types";

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 후속 발화가 전체 의도를 바꾸는지 / 조건 추가인지 등 분류.
 */
export function detectRefinementType(
  text: string,
  previous: ConversationContext | null
): RefinementType {
  const q = norm(text);
  if (!q) return previous ? "refine" : "new_request";

  /* "짜장면 말고" 등 메뉴 제외는 refine */
  if (
    /(짜장면|짬뽕|초밥|돈까스|국밥|파스타)\s*말고/.test(q) ||
    /중식\s*말고|중국\s*말고/.test(q)
  ) {
    return "refine";
  }

  /* "너무 복잡한 데는 싫어" — 결과 거절이 아니라 조건 추가(refine) */
  if (
    /싫어|싫다|싫은/.test(q) &&
    /(복잡|단순|시끄|멀리|맵|주차|데는\s*싫|곳은\s*싫|건\s*싫|않았으면|있으면\s*좋)/.test(q)
  ) {
    return previous ? "refine" : "new_request";
  }

  if (
    /별로야|별로\s*야|별로다|다른\s*데|다른데|싫어|안\s*갈래|패스|다시\s*골라|딴\s*거/.test(q) ||
    (/말고\s*$/.test(q) && !/(짜장|짬뽕|초밥|돈까스|국밥|파스타|중식|중국)/.test(q))
  ) {
    return "reject";
  }

  if (
    /이번엔|이번\s*에는|아니\s*미용|아니\s*카페|바꿔\s*줘|바꿔줘|처음부터|다시\s*찾아|미용실|네일\s*샵/.test(
      q
    ) ||
    /데이트\s*코스|코스로\s*바꿔|코스\s*짜/.test(q) ||
    (/카페\s*추천/.test(q) && !previous) ||
    (/놀거리\s*추천/.test(q) && !previous)
  ) {
    return "new_request";
  }

  if (previous && /카페\s*추천해|미용실\s*찾아|식당\s*말고\s*카페/.test(q)) return "new_request";

  if (/아니어도\s*돼|괜찮아|상관없|뭐든\s*좋아|다\s*괜찮/.test(q)) return "broaden";

  if (
    /가까운\s*데|가까운\s*곳|근처|멀리\s*는\s*싫|멀리\s*싫|실내\s*만|중식\s*만|일식\s*만/.test(q)
  ) {
    return "narrow";
  }

  if (/\?+\s*$|뭐가\s*좋|어디가\s*좋|추천해줘\?/.test(q) && q.length < 24) return "clarify";

  if (previous && previous.turns.filter((t) => t.role === "user").length >= 1) return "refine";

  return "new_request";
}
