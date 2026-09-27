import type { ConversationContext } from "./types";
import { validShownPlayCards } from "./linkedPurpose";
import { upsertDialogueEntry, type DialogueEntry } from "./dialogueHistory";

const STORAGE_KEY = "hama_conversation_context_v1";

export function loadConversationContext(): ConversationContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationContext;
    if (!parsed || typeof parsed !== "object" || !parsed.sessionId || !parsed.currentIntent) return null;
    if (!validShownPlayCards(parsed.frozenPlayCards)) delete parsed.frozenPlayCards;
    if (parsed.lastRecommendations && !validShownPlayCards(parsed.lastRecommendations.cards)) {
      parsed.lastRecommendations = { ...parsed.lastRecommendations, cards: undefined };
    }
    if (Array.isArray(parsed.dialogueHistory)) {
      parsed.dialogueHistory = parsed.dialogueHistory.filter(
        (entry) => entry && entry.userText && validShownPlayCards(entry.playCards)
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveConversationContext(ctx: ConversationContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore quota */
  }
}

export function clearConversationContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function latestUserText(ctx: ConversationContext): string | null {
  const user = [...ctx.turns].reverse().find((turn) => turn.role === "user");
  return user?.text ?? null;
}

export function canWriteRecommendationsForQuery(ctx: ConversationContext, forQuery?: string): boolean {
  if (!forQuery) return true;
  return latestUserText(ctx) === forQuery;
}

function latestUserTurn(ctx: ConversationContext) {
  return [...ctx.turns].reverse().find((turn) => turn.role === "user");
}

function canWriteForTurn(ctx: ConversationContext, forQuery?: string, turnId?: string): boolean {
  if (!turnId) return canWriteRecommendationsForQuery(ctx, forQuery);
  return latestUserTurn(ctx)?.turnId === turnId;
}

export function patchLastRecommendations(
  sessionId: string,
  placeIds: string[],
  forQuery?: string,
  cards?: import("@/lib/storeTypes").HomeCard[],
  turnId?: string
): void {
  const prev = loadConversationContext();
  if (!prev || prev.sessionId !== sessionId) return;
  if (!canWriteForTurn(prev, forQuery, turnId)) return;
  const ids = placeIds.filter(Boolean).slice(0, 20);
  if (!ids.length) return;
  const slim = cards?.slice(0, 20).map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    address: card.address ?? null,
    lat: card.lat ?? null,
    lng: card.lng ?? null,
    distanceKm: card.distanceKm,
    reasonText: card.reasonText,
  }));
  saveConversationContext({
    ...prev,
    lastRecommendations: {
      ...prev.lastRecommendations,
      placeIds: ids,
      query: forQuery ?? prev.lastRecommendations?.query,
      cards: slim && slim.length ? slim : prev.lastRecommendations?.cards,
    },
  });
}

export function recordShownPlayCards(
  sessionId: string,
  cards: import("@/lib/storeTypes").HomeCard[],
  playKey: string,
  forQuery?: string
): void {
  const prev = loadConversationContext();
  if (!prev || prev.sessionId !== sessionId) return;
  if (!canWriteRecommendationsForQuery(prev, forQuery)) return;
  if (!cards.length) return;
  saveConversationContext({
    ...prev,
    shownPlayCards: cards.slice(0, 20),
    shownPlayKey: playKey,
  });
}

export function recordDialogueSnapshot(sessionId: string, entry: DialogueEntry, forQuery?: string): void {
  const prev = loadConversationContext();
  if (!prev || prev.sessionId !== sessionId) return;
  if (!canWriteForTurn(prev, forQuery, entry.turnId)) return;
  if (!validShownPlayCards(entry.playCards)) return;
  saveConversationContext({
    ...prev,
    dialogueHistory: upsertDialogueEntry(prev.dialogueHistory, entry),
  });
}
