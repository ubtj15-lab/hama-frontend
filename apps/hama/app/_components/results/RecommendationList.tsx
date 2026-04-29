"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { RecommendationCard } from "./RecommendationCard";
import { space } from "@/lib/designTokens";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { logEvent } from "@/lib/logEvent";
import VisitFeedbackModal, { type VisitFeedbackPayload } from "@/_components/shared/VisitFeedbackModal";

const ENABLE_HAMA_PAY_UI = process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY === "true";

type Props = {
  cards: HomeCard[];
  scenarioObject: ScenarioObject | null;
  onPlaceClick: (card: HomeCard, rank: number) => void;
  onNavigate: (card: HomeCard, rank: number) => void;
  onCall: (card: HomeCard, rank: number) => void;
  analyticsV2Click?: LogRecommendationEventInput["analytics_v2"];
  /** 메인 카드 아래 — 후보 부족·재추천 등 */
  showSoftFallbackCopy?: boolean;
};

export function RecommendationList({
  cards,
  scenarioObject,
  onPlaceClick,
  onNavigate,
  onCall,
  analyticsV2Click,
  showSoftFallbackCopy = false,
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
      }),
    [scenarioObject?.rawQuery, scenarioObject?.scenario, scenarioObject?.intentCategory, scenarioObject?.recommendationMode]
  );
  const previousContextKeyRef = React.useRef<string | null>(null);
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
  const visibleRecommendations =
    stableRecommendations.length > 0 ? stableRecommendations : cards.slice(0, 3);
  const deckReasons = useDeckRecommendationReasons(visibleRecommendations, scenarioObject);

  React.useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  React.useEffect(() => {
    const prev = previousContextKeyRef.current;
    const contextChanged = prev !== null && prev !== contextKey;
    if (contextChanged) {
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
      setStableRecommendations(cards.slice(0, 3));
      previousContextKeyRef.current = contextKey;
      return;
    }
    if (previousContextKeyRef.current == null) {
      previousContextKeyRef.current = contextKey;
    }
    if (selectedPlaceId) return;
    if (stableRecommendations.length === 0 && cards.length > 0) {
      setStableRecommendations(cards.slice(0, 3));
    }
  }, [contextKey, cards, stableRecommendations.length, selectedPlaceId]);

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
      incomingCount: cards.length,
      stableCount: stableRecommendations.length,
      contextKey,
      selectedPlaceId,
    });
  }, [cards.length, stableRecommendations.length, contextKey, selectedPlaceId]);

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
    console.log("[recommendation visible]", {
      visibleCount: visibleRecommendations.length,
      names: visibleRecommendations.map((c) => c.name),
    });
  }, [visibleRecommendations]);

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
    const top = visibleRecommendations[0];
    if (!top) return;
    setFeedbackDone(value);
    setToast("감사합니다");
    window.setTimeout(() => setToast(null), 1500);
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

  const choosePlace = async (card: HomeCard, rank: number) => {
    const cardPlaceId = getCardPlaceId(card);
    console.log("[choose here clicked]", { cardPlaceId, cardName: card.name });
    setSelectedPlaceId(cardPlaceId);
    setSelectedPlaceLogId(null);
    setVerificationOpenPlaceId(null);
    setVerificationSubmittedPlaceId(null);
    const loggedIn = typeof window !== "undefined" && window.localStorage.getItem("hamaLoggedIn") === "1";
    if (!loggedIn) {
      alert("로그인 후 참여 기록을 남길 수 있어요.");
      onPlaceClick(card, rank);
      return;
    }
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
  };

  const verifyReceipt = async () => {
    if (!selectedPlaceId || receiptVerifying) return;
    const loggedIn = typeof window !== "undefined" && window.localStorage.getItem("hamaLoggedIn") === "1";
    if (!loggedIn) {
      alert("로그인 후 참여 기록을 남길 수 있어요.");
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
    try {
      setReceiptVerifying(true);
      setReceiptResult(null);
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
      const loggedIn = typeof window !== "undefined" && window.localStorage.getItem("hamaLoggedIn") === "1";
      if (!loggedIn) {
        alert("로그인 후 이용해 주세요.");
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
              onPlaceClick(card, i);
            }}
            onChooseHere={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void choosePlace(card, i);
            }}
            onNavigate={() => onNavigate(card, i)}
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
                  await choosePlace(card, i);
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
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
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
