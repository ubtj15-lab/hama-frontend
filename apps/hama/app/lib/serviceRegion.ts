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
