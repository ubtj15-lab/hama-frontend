/**
 * HAMA 서비스 지역: 오산·동탄·평택만 노출 (area/address 텍스트 기준)
 * — DB에 서울·충청·전국 등이 섞여 있을 때 클라이언트/API에서 공통 필터
 */
const SERVICE_REGION_KEYWORDS = ["오산", "동탄", "평택"] as const;

export function matchesServiceRegion(area: string | null | undefined, address: string | null | undefined): boolean {
  const blob = `${area ?? ""} ${address ?? ""}`;
  return SERVICE_REGION_KEYWORDS.some((k) => blob.includes(k));
}

export function storeRowMatchesServiceRegion(row: { area?: unknown; address?: unknown }): boolean {
  const area = row.area != null ? String(row.area) : "";
  const address = row.address != null ? String(row.address) : "";
  return matchesServiceRegion(area, address);
}

/**
 * 서비스 지역 우선 노출. 필터 후 0건이면서 원본 행이 있으면 전체 행을 씀(데이터가 다른 지역만 있을 때 빈 화면 방지).
 */
export function filterRowsByServiceRegion<T extends { area?: unknown; address?: unknown }>(rows: T[]): T[] {
  const inRegion = rows.filter(storeRowMatchesServiceRegion);
  if (inRegion.length > 0) return inRegion;
  if (rows.length > 0 && typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn(
      "[serviceRegion] No stores matched regional filter — using full fetch set (check area/address vs 오산·동탄·평택)"
    );
  }
  return rows;
}

/**
 * 매장명 검색: 서비스 지역 매칭을 **앞쪽 정렬**만 하고, 나머지 매칭도 **끝까지 포함** (전국 상호도 찾기).
 */
export function orderRowsServiceRegionFirst<
  T extends { id?: string; area?: unknown; address?: unknown },
>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const inR = rows.filter(storeRowMatchesServiceRegion);
  const inIds = new Set(inR.map((r) => String((r as { id?: string }).id ?? "")));
  const rest = rows.filter((r) => !inIds.has(String((r as { id?: string }).id ?? "")));
  return [...inR, ...rest];
}
