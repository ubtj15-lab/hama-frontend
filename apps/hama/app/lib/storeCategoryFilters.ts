import type { HomeTabKey } from "@/lib/storeTypes";

/**
 * Supabase `stores.category` — 탭별 허용 값 (플랫폼 코드 FD6/CE7/BK9/AT4 등).
 * 단일 `.eq(tab)`만 쓰면 DB 코드와 불일치해 0건이 됩니다.
 */
export function categoriesForHomeTab(tab: HomeTabKey): string[] | null {
  if (tab === "all") return null;
  switch (tab) {
    case "cafe":
      return ["cafe", "ce7", "CE7", "Cafe"];
    case "salon":
      return ["salon", "bk9", "BK9", "beauty", "Beauty"];
    case "restaurant":
      return ["restaurant", "fd6", "FD6", "food", "Food", "meal", "Meal"];
    case "activity":
      return ["activity", "at4", "AT4"];
    case "museum":
      return ["museum", "culture", "Culture", "gallery", "Gallery", "exhibition", "Exhibition"];
    default:
      return [tab];
  }
}
