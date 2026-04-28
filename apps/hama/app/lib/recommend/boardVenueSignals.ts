import type { HomeCard } from "@/lib/storeTypes";
import type { UserProfile } from "@/lib/onboardingProfile";

/** 동반자로 '혼자'만 선택된 경우(다인 의도 없음) */
export function isCompanionSoloOnly(profile: UserProfile | null | undefined): boolean {
  if (!profile?.companions?.length) return false;
  return profile.companions.length === 1 && profile.companions[0] === "혼자";
}

export function isBoardGameVenueFields(parts: {
  name?: string | null;
  category?: string | null;
  tags?: readonly string[] | null;
}): boolean {
  const cat = String(parts.category ?? "").toLowerCase();
  if (cat.includes("보드카페")) return true;
  const name = String(parts.name ?? "").toLowerCase();
  if (name.includes("보드게임")) return true;
  if (name.includes("보드")) return true;
  const tags = (parts.tags ?? []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("보드카페") || t.includes("보드게임"))) return true;
  return false;
}

export function isBoardGameVenue(card: HomeCard): boolean {
  return isBoardGameVenueFields({
    name: card.name,
    category: card.category,
    tags: card.tags,
  });
}
