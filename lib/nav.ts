// lib/nav.ts

// 거리를 m 단위로 계산 (Haversine)
export function metersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // m
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(m: number) {
  if (m < 100) return `${m}미터`;
  if (m < 1000) return `${Math.round(m / 10) * 10}미터`;
  const km = m / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)}킬로미터`;
}

// 간단한 명령 파서: "강남역까지 길안내", "코엑스 길 안내" -> "강남역", "코엑스"
export function extractGuideKeyword(raw: string) {
  const cleaned = raw
    .replace(/길\s*안내/g, "")
    .replace(/내비|네비|안내/g, "")
    .replace(/까지/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}
