/**
 * 장소 외부 링크는 이 모듈만 검증한다.
 * 검색으로 만든 주소는 확인된 매장 페이지가 아니다.
 */

export type PlaceLinkFields = {
  name?: string | null;
  address?: string | null;
  kakao_place_url?: string | null;
  kakaoPlaceUrl?: string | null;
  naver_place_url?: string | null;
  naverPlaceUrl?: string | null;
  naver_place_id?: string | null;
  naverPlaceId?: string | null;
};

export type ResolvedPlaceLink = {
  url: string;
  mode: "direct" | "search";
};

const NAVER_DIRECT_HOSTS = ["naver.me", "place.naver.com", "map.naver.com"] as const;
const NAVER_SEARCH_HOSTS = ["search.naver.com"] as const;
const NAVER_HOSTS = [...NAVER_DIRECT_HOSTS, ...NAVER_SEARCH_HOSTS] as const;
const KAKAO_HOSTS = ["kko.to", "map.kakao.com"] as const;

const NAVER_PLACE_ID = /^[0-9]{1,32}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hostAllowed(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function parseOfficialHttps(raw: string, allowed: readonly string[]): { href: string; hostname: string } | null {
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.port) return null;

  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  if (!hostAllowed(url.hostname, allowed)) return null;

  return { href: url.href, hostname: url.hostname.toLowerCase().replace(/\.$/, "") };
}

function searchQuery(input: PlaceLinkFields): string | null {
  const query = [text(input.name), text(input.address)].filter(Boolean).join(" ");
  return query || null;
}

function naverSearchUrl(query: string): string {
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

function kakaoSearchUrl(query: string): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}

export function resolveNaverPlaceLink(input: PlaceLinkFields): ResolvedPlaceLink | null {
  const stored = text(input.naver_place_url) || text(input.naverPlaceUrl);
  const official = stored ? parseOfficialHttps(stored, NAVER_HOSTS) : null;
  if (official) {
    const search = hostAllowed(official.hostname, NAVER_SEARCH_HOSTS);
    return { url: official.href, mode: search ? "search" : "direct" };
  }

  const placeId = text(input.naver_place_id) || text(input.naverPlaceId);
  if (NAVER_PLACE_ID.test(placeId)) {
    return {
      url: `https://m.place.naver.com/place/${encodeURIComponent(placeId)}`,
      mode: "direct",
    };
  }

  const query = searchQuery(input);
  if (!query) return null;
  return { url: naverSearchUrl(query), mode: "search" };
}

export function resolveKakaoPlaceLink(input: PlaceLinkFields): ResolvedPlaceLink | null {
  const stored = text(input.kakao_place_url) || text(input.kakaoPlaceUrl);
  const official = stored ? parseOfficialHttps(stored, KAKAO_HOSTS) : null;
  if (official && !hostAllowed(official.hostname, NAVER_HOSTS)) {
    return { url: official.href, mode: "direct" };
  }

  const query = searchQuery(input);
  if (!query) return null;
  return { url: kakaoSearchUrl(query), mode: "search" };
}

/** 카드 클릭처럼 검색창을 열면 안 되는 경로에서만 확인된 장소 주소를 쓴다. */
export function directExternalPlaceUrl(input: PlaceLinkFields): string | null {
  const naver = resolveNaverPlaceLink(input);
  if (naver?.mode === "direct") return naver.url;
  const kakao = resolveKakaoPlaceLink(input);
  if (kakao?.mode === "direct") return kakao.url;
  return null;
}

export function naverPlaceButtonLabel(link: ResolvedPlaceLink | null): string {
  return link?.mode === "direct" ? "네이버에서 보기" : "네이버에서 검색";
}

export function kakaoPlaceButtonLabel(link: ResolvedPlaceLink | null): string {
  return link?.mode === "direct" ? "카카오맵에서 보기" : "카카오맵에서 검색";
}

export function openResolvedPlaceLink(link: ResolvedPlaceLink | null): void {
  if (!link || typeof window === "undefined") return;
  const official = parseOfficialHttps(link.url, NAVER_HOSTS) ?? parseOfficialHttps(link.url, KAKAO_HOSTS);
  if (!official) return;
  window.open(official.href, "_blank", "noopener,noreferrer");
}
