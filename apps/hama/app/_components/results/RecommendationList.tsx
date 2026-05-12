"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { RecommendationCard } from "./RecommendationCard";
import { space } from "@/lib/designTokens";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { logEvent, logHamaEvent, getOrCreateSessionId } from "@/lib/logEvent";
import { extractSituationTags } from "@/lib/extractSituationTags";
import { HamaEventNames } from "@/lib/hamaEventNames";
import { inferDirectionsProvider } from "@/lib/inferDirectionsProvider";
import VisitFeedbackModal, { type VisitFeedbackPayload } from "@/_components/shared/VisitFeedbackModal";
import { getCardExposureId, saveRecentExposedStoreIds } from "@/lib/recommend/recentExposure";

const ENABLE_HAMA_PAY_UI = process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY === "true";

function hashDedupKey(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

type Props = {
  cards: HomeCard[];
  scenarioObject: ScenarioObject | null;
  /** 결과 음식 세부 프리셋 id — contextKey에 넣어 동일 시나리오에서 덱이 안 바뀌는 문제 방지 */
  namedFoodPresetId?: string | null;
  /** 반복 검색 시 회차·최근 노출 시그니처 — 안정 카드/context가 덱 교체를 가릴 때 사용 */
  deckRotationKey?: string | null;
  onPlaceClick: (card: HomeCard, rank: number) => void;
  onNavigate: (card: HomeCard, rank: number) => void;
  onCall: (card: HomeCard, rank: number) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  analyticsV2Click?: LogRecommendationEventInput["analytics_v2"];
  /** 메인 카드 아래 — 후보 부족·재추천 등 */
  showSoftFallbackCopy?: boolean;
  /** 추천 인상 메타: 주 추천 vs '이런 곳도 있어' */
  resultsSurface?: "primary" | "secondary";
};

export function RecommendationList({
  cards,
  scenarioObject,
  namedFoodPresetId = null,
  deckRotationKey = null,
  onPlaceClick,
  onNavigate,
  onCall,
  isLoggedIn = false,
  onRequireLogin,
  analyticsV2Click,
  showSoftFallbackCopy = false,
  resultsSurface = "primary",
}: Props) {
  const getCardPlaceId = React.useCallback(
    (card: HomeCard): string =>
      String(
        (card as { place_id?: string | null; store_id?: string | null }).place_id ??
          (card as { place_id?: string | null; store_id?: string | null }).store_id ??
          card.id
      ),
    []
  );
  const contextKey = React.useMemo(
    () =>
      JSON.stringify({
        rawQuery: scenarioObject?.rawQuery ?? "",
        query: scenarioObject?.rawQuery ?? "",
        category: scenarioObject?.intentCategory ?? "",
        scenario: scenarioObject?.scenario ?? "",
        intentCategory: scenarioObject?.intentCategory ?? "",
        recommendationMode: scenarioObject?.recommendationMode ?? "single",
        namedFoodPresetId: namedFoodPresetId ?? "",
        deckRotationKey: deckRotationKey ?? "",
      }),
    [
      scenarioObject?.rawQuery,
      scenarioObject?.scenario,
      scenarioObject?.intentCategory,
      scenarioObject?.recommendationMode,
      namedFoodPresetId,
      deckRotationKey,
    ]
  );
  const previousContextKeyRef = React.useRef<string | null>(null);
  /** 마지막으로 화면에 반영한 상위 덱 fingerprint (context 동일 시 cards만 바뀌어도 갱신) */
  const syncedIncomingFingerprintRef = React.useRef<string | null>(null);
  const [stableRecommendations, setStableRecommendations] = React.useState<HomeCard[]>([]);
  const [feedbackDone, setFeedbackDone] = React.useState<"like" | "neutral" | "dislike" | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [selectedPlaceLogId, setSelectedPlaceLogId] = React.useState<string | null>(null);
  const [mockLoadingPlaceId, setMockLoadingPlaceId] = React.useState<string | null>(null);
  const [showVisitFeedbackModal, setShowVisitFeedbackModal] = React.useState(false);
  const [paymentSnapshot, setPaymentSnapshot] = React.useState<{ placeId: string; placeName: string } | null>(null);
  const [visitFeedbackSaving, setVisitFeedbackSaving] = React.useState(false);
  const [decisionSavingPlaceId, setDecisionSavingPlaceId] = React.useState<string | null>(null);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = React.useState<string | null>(null);
  const [visitFeedbackTags, setVisitFeedbackTags] = React.useState<string[]>([]);
  const [visitFeedbackText, setVisitFeedbackText] = React.useState("");
  const [receiptVerifying, setReceiptVerifying] = React.useState(false);
  const [receiptResult, setReceiptResult] = React.useState<string | null>(null);
  const [verificationOpenPlaceId, setVerificationOpenPlaceId] = React.useState<string | null>(null);
  const [verificationSubmittedPlaceId, setVerificationSubmittedPlaceId] = React.useState<string | null>(null);
  const [showQuickFeedback, setShowQuickFeedback] = React.useState(false);
  const visibleRecommendations =
    stableRecommendations.length > 0 ? stableRecommendations : cards.slice(0, 3);
  const deckReasons = useDeckRecommendationReasons(visibleRecommendations, scenarioObject);

  const incomingTop3 = React.useMemo(() => cards.slice(0, 3), [cards]);
  const incomingDeckFingerprint = React.useMemo(
    () => incomingTop3.map((c) => `${getCardPlaceId(c)}:${String(c.name ?? "")}`).join("|"),
    [incomingTop3, getCardPlaceId]
  );

  const stableDeckFingerprint = React.useMemo(
    () =>
      stableRecommendations
        .slice(0, 3)
        .map((c) => `${getCardPlaceId(c)}:${String(c.name ?? "")}`)
        .join("|"),
    [stableRecommendations, getCardPlaceId]
  );

  const recommendationVisibleLogKey = React.useMemo(
    () =>
      stableRecommendations.length > 0
        ? `s:${stableDeckFingerprint}`
        : `i:${incomingDeckFingerprint}`,
    [stableRecommendations.length, stableDeckFingerprint, incomingDeckFingerprint]
  );

  React.useEffect(() => {
    const top = visibleRecommendations.slice(0, 3);
    if (top.length === 0) return;
    const query = scenarioObject?.rawQuery?.trim() ?? "";
    const fp = top.map((c) => `${getCardPlaceId(c)}:${String(c.name ?? "")}`).join("|");
    const sid = getOrCreateSessionId();
    if (!sid) return;
    const dedupKey = `hama_imp_${hashDedupKey(`${sid}::${query}::${fp}::${resultsSurface}`)}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(dedupKey)) return;
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(dedupKey, "1");
    } catch {
      return;
    }

    const sitTags = extractSituationTags(query);
    const deckNames = top.map((c) => c.name);
    const intentStr = scenarioObject ? String(scenarioObject.intentType) : "";
    const categoryStr = scenarioObject ? String(scenarioObject.intentCategory ?? "") : "";
    const modeStr = scenarioObject ? String(scenarioObject.recommendationMode ?? "") : "";

    top.forEach((card, idx) => {
      const reason = deckReasons[idx];
      const reasonMeta = reason
        ? {
            headline: reason.headline,
            subline: reason.subline,
            badges: reason.badges,
            scenarioLabel: reason.scenarioLabel,
          }
        : {};
      logHamaEvent({
        event_name: HamaEventNames.recommendationImpression,
        query: query || null,
        intent: intentStr || null,
        category: categoryStr || null,
        mode: modeStr || null,
        source: "results",
        place_id: getCardPlaceId(card),
        place_name: card.name,
        place_category: (card.category ?? card.categoryLabel ?? null) as string | null,
        rank_position: idx + 1,
        situation_tags: sitTags,
        metadata: {
          reason: reasonMeta,
          distanceKm: card.distanceKm ?? null,
          tags: (card.tags ?? []).slice(0, 8),
          renderedSource: resultsSurface,
          deckNames,
        },
      });
    });
  }, [visibleRecommendations, scenarioObject, deckReasons, getCardPlaceId, resultsSurface]);

  React.useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  React.useEffect(() => {
    if (cards.length === 0) {
      setStableRecommendations((prev) => (prev.length > 0 ? [] : prev));
      syncedIncomingFingerprintRef.current = "";
      return;
    }

    const next = cards.slice(0, 3);
    const prevCtx = previousContextKeyRef.current;
    const contextChanged = prevCtx !== null && prevCtx !== contextKey;

    if (contextChanged) {
      setSelectedPlaceId(null);
      setSelectedPlaceLogId(null);
      setReceiptFile(null);
      setVisitFeedbackTags([]);
      setVisitFeedbackText("");
      setReceiptPreviewUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
      setReceiptResult(null);
      setVerificationOpenPlaceId(null);
      setVerificationSubmittedPlaceId(null);
      setStableRecommendations(next);
      previousContextKeyRef.current = contextKey;
      syncedIncomingFingerprintRef.current = incomingDeckFingerprint;
      // eslint-disable-next-line no-console
      console.log("[recommendation stable sync]", {
        contextKey,
        reason: "context_changed" as const,
        nextNames: next.map((x) => x.name),
      });
      return;
    }

    if (previousContextKeyRef.current == null) {
      previousContextKeyRef.current = contextKey;
    }

    if (incomingDeckFingerprint !== syncedIncomingFingerprintRef.current) {
      if (selectedPlaceId) {
        const stillInNext = next.some(
          (c) => getCardPlaceId(c) === selectedPlaceId || c.id === selectedPlaceId
        );
        if (!stillInNext) {
          setSelectedPlaceId(null);
          setSelectedPlaceLogId(null);
        }
      }
      setStableRecommendations(next);
      syncedIncomingFingerprintRef.current = incomingDeckFingerprint;
      // eslint-disable-next-line no-console
      console.log("[recommendation stable sync]", {
        contextKey,
        reason: "cards_changed" as const,
        nextNames: next.map((x) => x.name),
      });
    }
  }, [contextKey, incomingDeckFingerprint, cards, selectedPlaceId, getCardPlaceId]);

  React.useEffect(() => {
    console.log("[decision state]", { selectedPlaceId, selectedPlaceLogId });
    console.log("[selected state]", { selectedPlaceId, selectedPlaceLogId });
  }, [selectedPlaceId, selectedPlaceLogId]);

  React.useEffect(() => {
    console.log("[recommendation freeze]", {
      selectedPlaceId,
      selectedPlaceLogId,
      stableCount: stableRecommendations.length,
      incomingCount: cards.length,
      shouldIgnoreIncomingCards: !!selectedPlaceId,
    });
  }, [selectedPlaceId, selectedPlaceLogId, stableRecommendations, cards.length]);

  React.useEffect(() => {
    console.log("[parent cards changed]", {
      contextKey,
      incomingNames: cards.slice(0, 3).map((x) => x.name),
      incomingCount: cards.length,
      incomingFingerprint: incomingDeckFingerprint,
    });
  }, [contextKey, cards, incomingDeckFingerprint]);

  React.useEffect(() => {
    console.log("[recommendation context]", {
      contextKey,
      previousContextKey: previousContextKeyRef.current,
      selectedPlaceId,
      incomingCount: cards.length,
      stableCount: stableRecommendations.length,
    });
  }, [contextKey, selectedPlaceId, cards.length, stableRecommendations.length]);

  React.useEffect(() => {
    const slice = stableRecommendations.length > 0 ? stableRecommendations : cards.slice(0, 3);
    console.log("[recommendation visible]", {
      contextKey,
      names: slice.map((c) => c.name),
      source: stableRecommendations.length > 0 ? "stable" : "incoming",
    });
  }, [contextKey, recommendationVisibleLogKey, stableRecommendations, cards]);

  React.useEffect(() => {
    const exposed = visibleRecommendations.slice(0, 3);
    if (exposed.length === 0) return;
    const exposedIds = exposed
      .map((card) => getCardExposureId(card))
      .filter(Boolean);
    if (exposedIds.length === 0) return;
    const storageAfterSave = saveRecentExposedStoreIds(exposedIds);
    console.log("[recent exposure saved]", {
      exposedIds,
      exposedNames: exposed.map((card) => card.name),
      storageAfterSave,
    });
  }, [recommendationVisibleLogKey, visibleRecommendations]);

  React.useEffect(() => {
    console.log(
      "[stable cards]",
      stableRecommendations.map((c) => ({
        id: c.id,
        place_id: (c as { place_id?: string | null }).place_id ?? null,
        name: c.name,
      }))
    );
  }, [stableRecommendations]);

  const submitFeedback = (value: "like" | "neutral" | "dislike") => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    const top = visibleRecommendations[0];
    if (!top) return;
    setFeedbackDone(value);
    setToast("감사합니다");
    window.setTimeout(() => setToast(null), 1500);
    logHamaEvent({
      event_name: HamaEventNames.recommendationHelpfulFeedback,
      query: scenarioObject?.rawQuery?.trim() ?? null,
      intent: scenarioObject ? String(scenarioObject.intentType) : null,
      category: scenarioObject ? String(scenarioObject.intentCategory ?? "") : null,
      mode: scenarioObject ? String(scenarioObject.recommendationMode ?? "") : null,
      source: "results",
      place_id: top.id,
      place_name: top.name,
      rank_position: 1,
      situation_tags: extractSituationTags(scenarioObject?.rawQuery ?? ""),
      metadata: { feedback: value, message: "이 추천 도움됐나요?" },
    });
    logRecommendationEvent({
      event_name: "place_feedback",
      entity_type: "place",
      entity_id: top.id,
      recommendation_rank: 1,
      scenario: scenarioObject?.scenario ?? null,
      source_page: "results",
      place_ids: [top.id],
      metadata: {
        feedback: value,
        message: "이 추천 도움됐나요?",
      },
      analytics_v2: {
        ...(analyticsV2Click ?? {}),
        action: "feedback",
        selected_place_id: top.id,
        feedback: value,
      } as LogRecommendationEventInput["analytics_v2"],
    });
  };

  const choosePlace = async (card: HomeCard, rank: number): Promise<boolean> => {
    const cardPlaceId = getCardPlaceId(card);
    console.log("[choose here clicked]", { cardPlaceId, cardName: card.name });
    if (!isLoggedIn) {
      const q = scenarioObject?.rawQuery?.trim() ?? "";
      logHamaEvent({
        event_name: HamaEventNames.loginRequiredAction,
        action: "choose_place",
        query: q || null,
        intent: scenarioObject ? String(scenarioObject.intentType) : null,
        category: scenarioObject ? String(scenarioObject.intentCategory ?? "") : null,
        mode: scenarioObject ? String(scenarioObject.recommendationMode ?? "") : null,
        source: "results",
        place_id: cardPlaceId,
        place_name: card.name,
        rank_position: rank + 1,
        situation_tags: extractSituationTags(q),
        metadata: { isLoggedIn: false, blockedByLogin: true },
      });
      onRequireLogin?.();
      return false;
    }
    setSelectedPlaceId(cardPlaceId);
    setSelectedPlaceLogId(null);
    setVerificationOpenPlaceId(null);
    setVerificationSubmittedPlaceId(null);
    try {
      setDecisionSavingPlaceId(card.id);
      const res = await fetch("/api/beta/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: cardPlaceId,
          place_name: card.name,
          recommendation_id: `results_rank_${rank + 1}`,
          context_json: {
            source_page: "results",
            card_rank: rank + 1,
            scenario: scenarioObject?.scenario ?? null,
            query: scenarioObject?.rawQuery ?? null,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        selected_place_log_id?: string | null;
        selectedPlaceLogId?: string | null;
      };
      if (!res.ok || !json.ok) {
        alert("선택 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } else {
        const logIdRaw = json.selected_place_log_id ?? json.selectedPlaceLogId ?? null;
        const logId = typeof logIdRaw === "string" ? logIdRaw : null;
        setSelectedPlaceLogId(logId);
        setSelectedPlaceId(cardPlaceId);
        logEvent("decision_confirmed", { place_id: card.id, place_name: card.name, source: "results", card_rank: rank + 1 });
        const qOk = scenarioObject?.rawQuery?.trim() ?? "";
        logHamaEvent({
          event_name: HamaEventNames.choosePlace,
          query: qOk || null,
          intent: scenarioObject ? String(scenarioObject.intentType) : null,
          category: scenarioObject ? String(scenarioObject.intentCategory ?? "") : null,
          mode: scenarioObject ? String(scenarioObject.recommendationMode ?? "") : null,
          source: "results",
          place_id: cardPlaceId,
          place_name: card.name,
          rank_position: rank + 1,
          situation_tags: extractSituationTags(qOk),
          metadata: { isLoggedIn: true, blockedByLogin: false },
        });
        console.log("[decision] selected place:", {
          place_id: cardPlaceId,
          place_name: card.name,
          selectedPlaceLogId: logId,
        });
        setToast("좋은 선택이에요");
      }
    } catch (e) {
      console.error("[beta decision] failed", e);
      alert("선택 저장 중 오류가 발생했어요.");
    } finally {
      setDecisionSavingPlaceId(null);
      setReceiptResult(null);
      setReceiptFile(null);
      setVisitFeedbackTags([]);
      setVisitFeedbackText("");
      setReceiptPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    if (ENABLE_HAMA_PAY_UI && card.hama_pay_enabled === true) {
      logEvent("hama_pay_available_viewed", {
        place_id: card.id,
        place_name: card.name,
        card_rank: rank,
        source: "results",
      });
    }
    return true;
  };

  const verifyReceipt = async () => {
    if (!selectedPlaceId || receiptVerifying) return;
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    if (!receiptFile) {
      alert("영수증 사진을 첨부해 주세요.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(receiptFile.type)) {
      alert("jpg/png/webp 파일만 업로드할 수 있어요.");
      return;
    }
    if (receiptFile.size > 5 * 1024 * 1024) {
      alert("5MB 이하 파일만 업로드할 수 있어요.");
      return;
    }
    if (!selectedPlaceLogId) {
      alert("선택 기록 저장 중이에요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const selectedCard = visibleRecommendations.find((card) => getCardPlaceId(card) === selectedPlaceId);
    const selectedPlaceName = selectedCard?.name?.trim() ?? "";
    if (!selectedPlaceName) {
      alert("선택한 매장 정보를 찾을 수 없어요. 다시 선택해 주세요.");
      return;
    }
    console.log("[receipt verify submit]", {
      storeId: selectedPlaceId,
      storeName: selectedPlaceName,
      isLoggedIn,
      hasFile: Boolean(receiptFile),
      hasText: Boolean(visitFeedbackText.trim()),
      endpoint: "/api/beta/receipt-verify",
    });
    try {
      setReceiptVerifying(true);
      setReceiptResult(null);
      logHamaEvent({
        event_name: HamaEventNames.receiptVerifyClick,
        query: scenarioObject?.rawQuery?.trim() ?? null,
        source: "results",
        place_id: selectedPlaceId,
        place_name: selectedPlaceName,
        situation_tags: extractSituationTags(scenarioObject?.rawQuery ?? ""),
      });
      logEvent("receipt_verification_started", { source: "results", selected_place_id: selectedPlaceId });
      const res = await fetch("/api/beta/receipt-verify", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.set("selected_place_log_id", selectedPlaceLogId);
          fd.set("receipt_place_name", selectedPlaceName);
          fd.set("receipt_image", receiptFile);
          fd.set("feedback_tags", JSON.stringify(visitFeedbackTags));
          fd.set("feedback_text", visitFeedbackText.trim());
          return fd;
        })(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        message?: string;
        error?: string;
      };
      console.log("[receipt verify response]", {
        ok: Boolean(json.ok),
        status: res.status,
        message: json.message ?? json.error ?? null,
      });
      if (!res.ok || !json.ok) {
        setReceiptResult("인증 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      logEvent("receipt_verification_submitted", { source: "results", selected_place_id: selectedPlaceId });
      setReceiptResult(json.message ?? "인증 제출 완료. 관리자 확인 후 참여 횟수에 반영돼요.");
      setVerificationSubmittedPlaceId(selectedPlaceId);
      setVerificationOpenPlaceId(null);
    } catch (e) {
      console.error("[receipt verify] failed", e);
      setReceiptResult("인증 중 오류가 발생했어요.");
    } finally {
      setReceiptVerifying(false);
    }
  };

  const resetSelection = () => {
    setSelectedPlaceId(null);
    setSelectedPlaceLogId(null);
    setReceiptFile(null);
    setVisitFeedbackTags([]);
    setVisitFeedbackText("");
    setReceiptPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setReceiptResult(null);
    setVerificationOpenPlaceId(null);
    setVerificationSubmittedPlaceId(null);
    setToast("같은 추천 세트에서 다시 고를 수 있어요.");
  };

  const submitMockPayment = async (card: HomeCard, rank: number) => {
    try {
      if (!isLoggedIn) {
        onRequireLogin?.();
        return;
      }
      setMockLoadingPlaceId(card.id);
      const res = await fetch("/api/hama-pay/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: card.id,
          place_name: card.name,
          amount: null,
          context_json: {
            source_page: "results",
            card_rank: rank,
            scenario: scenarioObject?.scenario ?? null,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !json.ok) {
        alert("결제 완료 테스트 저장에 실패했어요. (테이블 미생성 상태일 수 있어요)");
      } else {
        logEvent("hama_pay_mock_completed", {
          place_id: card.id,
          place_name: card.name,
          card_rank: rank,
          source: "results",
        });
        setPaymentSnapshot({ placeId: card.id, placeName: card.name });
        setShowVisitFeedbackModal(true);
      }
    } catch (e) {
      console.error("[hama-pay mock] failed", e);
      alert("결제 완료 테스트 처리 중 오류가 발생했어요.");
    } finally {
      setMockLoadingPlaceId(null);
    }
  };

  const submitVisitFeedback = async (payload: VisitFeedbackPayload) => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    if (!paymentSnapshot || visitFeedbackSaving) return;
    setVisitFeedbackSaving(true);
    try {
      const reqBody = {
        place_id: paymentSnapshot.placeId,
        place_name: paymentSnapshot.placeName,
        source: "hama_pay",
        satisfaction: payload.satisfaction,
        feedback_tags: Array.isArray(payload.feedback_tags) ? payload.feedback_tags : [],
        memo: typeof payload.memo === "string" && payload.memo.trim().length > 0 ? payload.memo.trim() : null,
      };
      console.log("[visit-feedback] request(results):", reqBody);
      const res = await fetch("/api/visit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
      console.log("[visit-feedback] response(results):", { status: res.status, ...json });
      if (!res.ok || !json.ok) {
        console.error("[visit-feedback] failed(results):", { status: res.status, ...json, reqBody });
        alert(`피드백 저장에 실패했어요.\n${json.error ?? "unknown_error"}${json.detail ? `: ${json.detail}` : ""}`);
        return;
      }
      logHamaEvent({
        event_name: HamaEventNames.visitFeedbackSubmit,
        query: scenarioObject?.rawQuery?.trim() ?? null,
        source: "results",
        place_id: paymentSnapshot.placeId,
        place_name: paymentSnapshot.placeName,
        situation_tags: extractSituationTags(scenarioObject?.rawQuery ?? ""),
        metadata: {
          satisfaction: payload.satisfaction,
          feedback_tags: payload.feedback_tags,
        },
      });
      logEvent("visit_feedback_submitted", {
        place_id: paymentSnapshot.placeId,
        place_name: paymentSnapshot.placeName,
        satisfaction: payload.satisfaction,
        tags: payload.feedback_tags,
      });
      console.log("visit_feedback_saved");
      setShowVisitFeedbackModal(false);
      setToast("방문 피드백 저장 완료");
      window.setTimeout(() => setToast(null), 1800);
    } catch (e) {
      console.error("[visit-feedback] failed", e);
      alert("피드백 저장 중 오류가 발생했어요.");
    } finally {
      setVisitFeedbackSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
      {visibleRecommendations.map((card, i) => {
        const cardPlaceId = getCardPlaceId(card);
        const shouldShowReceiptVerify = cardPlaceId === selectedPlaceId;
        const isVerificationExpanded = verificationOpenPlaceId === cardPlaceId;
        const isVerificationSubmitted = verificationSubmittedPlaceId === cardPlaceId;
        console.log("[receipt ui visibility]", {
          cardPlaceId,
          selectedPlaceId,
          selectedPlaceLogId,
          shouldShowReceiptVerify,
        });
        return (
        <React.Fragment key={card.id}>
          <RecommendationCard
            card={card}
            rank={i}
            scenarioObject={scenarioObject}
            reason={deckReasons[i]}
            showSoftFallbackCopy={showSoftFallbackCopy}
            analyticsV2Click={analyticsV2Click}
            onCardClick={() => {
              console.log("[card click]", {
                cardPlaceId,
                cardName: card.name,
                selectedPlaceId,
                contextKey,
              });
              console.log("[stableRecommendations before/after card click]", {
                stableCount: stableRecommendations.length,
                names: stableRecommendations.map((c) => c.name),
              });
              if (selectedPlaceId && selectedPlaceId !== cardPlaceId) {
                console.log("[card click after selection]", {
                  clickedPlaceId: cardPlaceId,
                  selectedPlaceId,
                  ignored: true,
                });
                setToast("이미 선택한 매장이 있어요. 인증을 진행하거나 다시 고르기를 눌러주세요.");
                return;
              }
              console.log("[card click after selection]", {
                clickedPlaceId: cardPlaceId,
                selectedPlaceId,
                ignored: false,
              });
              const qClick = scenarioObject?.rawQuery?.trim() ?? "";
              logHamaEvent({
                event_name: HamaEventNames.recommendationClick,
                query: qClick || null,
                intent: scenarioObject ? String(scenarioObject.intentType) : null,
                category: scenarioObject ? String(scenarioObject.intentCategory ?? "") : null,
                mode: scenarioObject ? String(scenarioObject.recommendationMode ?? "") : null,
                source: "results",
                place_id: cardPlaceId,
                place_name: card.name,
                rank_position: i + 1,
                situation_tags: extractSituationTags(qClick),
              });
              onPlaceClick(card, i);
            }}
            onChooseHere={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void choosePlace(card, i);
            }}
            onNavigate={() => {
              const qNav = scenarioObject?.rawQuery?.trim() ?? "";
              logHamaEvent({
                event_name: HamaEventNames.directionsClick,
                query: qNav || null,
                intent: scenarioObject ? String(scenarioObject.intentType) : null,
                category: scenarioObject ? String(scenarioObject.intentCategory ?? "") : null,
                mode: scenarioObject ? String(scenarioObject.recommendationMode ?? "") : null,
                source: "results",
                place_id: cardPlaceId,
                place_name: card.name,
                rank_position: i + 1,
                situation_tags: extractSituationTags(qNav),
                metadata: {
                  provider: inferDirectionsProvider(card),
                  distanceKm: card.distanceKm ?? null,
                },
              });
              onNavigate(card, i);
            }}
            onCall={() => onCall(card, i)}
            selected={cardPlaceId === selectedPlaceId}
            hamaPayEnabled={card.hama_pay_enabled === true}
            onMockPayment={() => submitMockPayment(card, i)}
            mockPaymentBusy={mockLoadingPlaceId === card.id}
            showVerificationEntry={true}
            showVisitVerification={shouldShowReceiptVerify}
            verificationExpanded={isVerificationExpanded}
            verificationSubmitted={isVerificationSubmitted}
            receiptFileName={shouldShowReceiptVerify && receiptFile ? receiptFile.name : null}
            receiptPreviewUrl={shouldShowReceiptVerify ? receiptPreviewUrl : null}
            visitFeedbackTags={shouldShowReceiptVerify ? visitFeedbackTags : []}
            visitFeedbackText={shouldShowReceiptVerify ? visitFeedbackText : ""}
            receiptVerifying={shouldShowReceiptVerify ? receiptVerifying : false}
            receiptResult={shouldShowReceiptVerify ? receiptResult : null}
            onReceiptFileChange={(file) => {
              setReceiptFile(file);
              setReceiptPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return file ? URL.createObjectURL(file) : null;
              });
            }}
            onToggleVisitFeedbackTag={(tag) => {
              setVisitFeedbackTags((prev) =>
                prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
              );
            }}
            onVisitFeedbackTextChange={(value) => setVisitFeedbackText(value)}
            onToggleVerification={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedPlaceId !== cardPlaceId) {
                void (async () => {
                  const picked = await choosePlace(card, i);
                  if (!picked) return;
                  setVerificationOpenPlaceId(cardPlaceId);
                  setVerificationSubmittedPlaceId(null);
                  setReceiptResult(null);
                })();
                return;
              }
              setVerificationOpenPlaceId(cardPlaceId);
              setVerificationSubmittedPlaceId(null);
              setReceiptResult(null);
            }}
            onSubmitVerification={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void verifyReceipt();
            }}
            onResetSelection={(e) => {
              e.preventDefault();
              e.stopPropagation();
              resetSelection();
            }}
          />
          {i === 0 ? (
            <div
              style={{
                marginTop: -6,
                borderRadius: 14,
                border: "1px solid #E5E7EB",
                background: "#fff",
                padding: "10px 12px",
                display: "grid",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowQuickFeedback((prev) => !prev)}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid #CBD5E1",
                  background: "#fff",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                방문 후 인증/피드백 남기기 {showQuickFeedback ? "▴" : "▾"}
              </button>
              {showQuickFeedback ? (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginRight: 6 }}>
                    이 추천 도움됐나요?
                  </span>
                  {[
                    { id: "like", label: "👍 좋아요" },
                    { id: "neutral", label: "😐 그냥" },
                    { id: "dislike", label: "👎 별로" },
                  ].map((b) => {
                    const active = feedbackDone === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => submitFeedback(b.id as "like" | "neutral" | "dislike")}
                        style={{
                          border: active ? "1px solid #2563EB" : "1px solid #CBD5E1",
                          background: active ? "#EFF6FF" : "#fff",
                          color: active ? "#1D4ED8" : "#334155",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "6px 10px",
                          cursor: "pointer",
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                  {toast ? (
                    <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#16A34A" }}>
                      {toast}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </React.Fragment>
      );
      })}
      {visibleRecommendations.length > 0 ? (
        <div
          style={{
            borderRadius: 999,
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #E5E7EB",
            color: "#6B7280",
            fontSize: 13,
            fontWeight: 700,
            padding: "10px 14px",
          }}
        >
          ⓘ 근처 실제 매장 기준으로 추천했어요. 상황에 따라 혼잡도는 달라질 수 있어요.
        </div>
      ) : null}

      <VisitFeedbackModal
        open={showVisitFeedbackModal}
        onClose={() => setShowVisitFeedbackModal(false)}
        onSubmit={submitVisitFeedback}
        submitting={visitFeedbackSaving}
        placeName={paymentSnapshot?.placeName ?? null}
      />
    </div>
  );
}
