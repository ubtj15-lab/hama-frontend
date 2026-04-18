import type { DateTimeBand, ScenarioObject } from "./types";
import { normIntentQuery } from "./intentQueryNormalize";

/**
 * 쿼리에서 데이트 시간대(낮/저녁/밤) 추론.
 */
export function inferDateTimeBandFromQuery(rawQuery: string): DateTimeBand | undefined {
  const q = normIntentQuery(rawQuery);

  if (/(밤\s*10|22\s*시|밤\s*열|심야|야식\s*후|한밤)/.test(q)) return "night";
  if (/(저녁\s*7|오후\s*7|19\s*시|저녁\s*여덟|20\s*시|18\s*시|저녁|디너)/.test(q)) return "evening";
  if (/(오후\s*2|14\s*시|오후\s*두|브런치|점심\s*후\s*한티|한티타임)/.test(q)) return "daytime";
  if (/(오전|아침\s*데이트|브런치)/.test(q)) return "daytime";

  return undefined;
}

/**
 * `dateTimeBand` 수동값 → 없으면 쿼리·timeOfDay·시계.
 */
export function resolveDateTimeBand(obj: ScenarioObject, clock?: Date): DateTimeBand {
  if (obj.dateTimeBand) return obj.dateTimeBand;

  const inferred = inferDateTimeBandFromQuery(obj.rawQuery ?? "");
  if (inferred) return inferred;

  const t = obj.timeOfDay;
  if (t === "morning" || t === "lunch" || t === "afternoon") return "daytime";
  if (t === "dinner") return "evening";
  if (t === "night") return "night";

  if (clock) {
    const h = clock.getHours();
    if (h >= 5 && h < 17) return "daytime";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  return "evening";
}

export function defaultStartTimeForDateBand(band: DateTimeBand): string {
  switch (band) {
    case "daytime":
      return "11:00";
    case "evening":
      return "18:30";
    case "night":
      return "21:00";
  }
}
