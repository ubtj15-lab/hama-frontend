import type { ConversationContext } from "./types";

const STORAGE_KEY = "hama_conversation_context_v1";

export function loadConversationContext(): ConversationContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConversationContext;
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

export function patchLastRecommendations(sessionId: string, placeIds: string[]): void {
  const prev = loadConversationContext();
  if (!prev || prev.sessionId !== sessionId) return;
  saveConversationContext({
    ...prev,
    lastRecommendations: { ...prev.lastRecommendations, placeIds },
  });
}
