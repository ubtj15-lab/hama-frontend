import type { HomeCard } from "@/lib/storeTypes";

export type DialogueEntry = {
  turnId?: string;
  userText: string;
  assistantText?: string;
  playCards: HomeCard[];
  foodCards?: HomeCard[];
  anchorName?: string | null;
  provisional?: boolean;
  playRefreshNote?: string | null;
};

function slim(card: HomeCard): HomeCard {
  return {
    id: card.id,
    name: card.name,
    category: card.category,
    categoryLabel: card.categoryLabel,
    address: card.address ?? null,
    lat: card.lat ?? null,
    lng: card.lng ?? null,
    distanceKm: card.distanceKm,
    reasonText: card.reasonText,
    phone: card.phone ?? null,
    image_url: card.image_url ?? card.imageUrl ?? null,
    imageUrl: card.imageUrl ?? card.image_url ?? null,
  };
}

export function upsertDialogueEntry(history: readonly DialogueEntry[] | undefined, entry: DialogueEntry): DialogueEntry[] {
  const nextEntry: DialogueEntry = {
    ...entry,
    playCards: entry.playCards.slice(0, 3).map(slim),
    foodCards: entry.foodCards?.slice(0, 3).map(slim),
  };
  const prev = [...(history ?? [])];
  const index = entry.turnId
    ? prev.findIndex((item) => item.turnId === entry.turnId)
    : prev.findIndex((item) => !item.turnId && item.userText === entry.userText);
  if (index < 0) return [...prev, nextEntry];
  const kept = prev[index]!;
  prev[index] = {
    ...kept,
    ...nextEntry,
    playCards: nextEntry.playCards.length || nextEntry.playRefreshNote ? nextEntry.playCards : kept.playCards,
    foodCards: nextEntry.foodCards ?? kept.foodCards,
    playRefreshNote: nextEntry.playRefreshNote === undefined ? kept.playRefreshNote : nextEntry.playRefreshNote,
  };
  return prev;
}
