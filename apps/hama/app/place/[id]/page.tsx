"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { HomeCard } from "@/lib/storeTypes";
import { readPlaceFromSession } from "@/lib/session/placeSession";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { getNextSuggestions } from "@/lib/recommendation/getNextSuggestions";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { openPlace } from "@/lib/openPlace";
import {
  buildRecommendationBullets,
  buildRecommendationReason,
  getClientTimeOfDay,
} from "@/lib/recommend/buildRecommendationReason";
import { useSaved } from "@/_hooks/useSaved";
import { ReservationSummaryCard } from "@/_components/reservation/ReservationSummaryCard";
import { getReservationPreviewForStore } from "@/lib/reservation/bookingDummy";
import { buildReserveQueryFromPlace } from "@/lib/reservation/buildReserveSearchParams";
import VisitFeedbackModal, { type VisitFeedbackPayload } from "@/_components/shared/VisitFeedbackModal";

const ENABLE_HAMA_PAY_UI = process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY === "true";
const SHOW_HAMA_PAY_MOCK =
  ENABLE_HAMA_PAY_UI &&
  (process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY_MOCK === "true");

function bizKr(card: HomeCard): string {
  const s = businessStateFromCard(card);
  if (s === "OPEN") return "영업중";
  if (s === "BREAK") return "브레이크";
  if (s === "CLOSED") return "영업 종료";
  return "영업 정보 확인";
}

function parkingHintFromCard(card: HomeCard): string | null {
  const parts = [
    card.description ?? "",
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
  ].join(" ");
  if (!/(주차|발렛|valet|parking)/i.test(parts)) return null;
  if (/무료\s*주차|주차\s*무료/.test(parts)) return "데이터에 ‘무료 주차’ 언급이 있어요. 방문 전 한 번 더 확인하면 좋아요.";
  if (/유료\s*주차|주차\s*유료/.test(parts)) return "데이터에 ‘유료 주차’ 언급이 있어요. 요금은 매장·지도에서 확인해 주세요.";
  return "데이터에 주차 관련 언급이 있어요. 자세한 안내는 아래 링크에서 확인할 수 있어요.";
}

export default function PlaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(String(params.id ?? ""));
  const [card, setCard] = useState<HomeCard | null>(null);
  const [payMockSaving, setPayMockSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [betaSelectedLogId, setBetaSelectedLogId] = useState<string | null>(null);
  const [betaVerifyOpen, setBetaVerifyOpen] = useState(false);
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  const [betaReceiptFile, setBetaReceiptFile] = useState<File | null>(null);
  const [betaReceiptPreviewUrl, setBetaReceiptPreviewUrl] = useState<string | null>(null);
  const [betaFeedbackTags, setBetaFeedbackTags] = useState<string[]>([]);
  const [betaFeedbackText, setBetaFeedbackText] = useState("");
  const [betaSubmitting, setBetaSubmitting] = useState(false);
  const [betaMessage, setBetaMessage] = useState<string | null>(null);
  const { isSaved, toggleSaved } = useSaved();

  useEffect(() => {
    if (!id) return;
    setCard(readPlaceFromSession(id));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/stores/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; item?: Record<string, unknown> }
          | null;
        const item = json?.item;
        if (!json?.ok || !item || cancelled) return;
        const merged: HomeCard = {
          ...(readPlaceFromSession(id) ?? {}),
          ...(card ?? {}),
          id: String(item.id ?? id),
          name: String(item.name ?? card?.name ?? ""),
          category: (item.category as string | null | undefined) ?? card?.category ?? null,
          area: (item.area as string | null | undefined) ?? card?.area ?? null,
          address: (item.address as string | null | undefined) ?? card?.address ?? null,
          lat: typeof item.lat === "number" ? item.lat : card?.lat ?? null,
          lng: typeof item.lng === "number" ? item.lng : card?.lng ?? null,
          phone: (item.phone as string | null | undefined) ?? card?.phone ?? null,
          image_url: (item.image_url as string | null | undefined) ?? card?.image_url ?? null,
          tags: Array.isArray(item.tags) ? (item.tags as string[]) : card?.tags ?? [],
          mood: Array.isArray(item.mood) ? (item.mood as string[]) : card?.mood ?? [],
          description: (item.description as string | null | undefined) ?? card?.description ?? null,
          with_kids: typeof item.with_kids === "boolean" ? item.with_kids : card?.with_kids ?? null,
          hama_pay_enabled:
            typeof item.hama_pay_enabled === "boolean"
              ? item.hama_pay_enabled
              : card?.hama_pay_enabled ?? null,
          for_work: typeof item.for_work === "boolean" ? item.for_work : card?.for_work ?? null,
          reservation_required:
            typeof item.reservation_required === "boolean"
              ? item.reservation_required
              : card?.reservation_required ?? null,
          price_level: (item.price_level as string | null | undefined) ?? card?.price_level ?? null,
          updated_at: (item.updated_at as string | null | undefined) ?? card?.updated_at ?? null,
        };
        setCard(merged);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!card) return;
    logEvent(HamaEvents.place_detail_view, { place_id: card.id, page: "place_detail" });
  }, [card]);

  useEffect(() => {
    return () => {
      if (betaReceiptPreviewUrl) URL.revokeObjectURL(betaReceiptPreviewUrl);
    };
  }, [betaReceiptPreviewUrl]);

  if (!card) {
    return (
      <main style={{ padding: space.pageX, maxWidth: 430, margin: "0 auto" }}>
        <p style={{ color: colors.textSecondary }}>매장 정보를 불러올 수 없어요.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            borderRadius: radius.button,
            border: "none",
            background: colors.accentPrimary,
            color: colors.accentOnPrimary,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          홈으로
        </button>
      </main>
    );
  }

  const img =
    (card as any).imageUrl ?? (card as any).image_url ?? getDefaultCardImage(card);
  const tel = String(card.phone ?? "").trim();
  const reason = buildRecommendationReason(card, { timeOfDay: getClientTimeOfDay() });
  const bullets = buildRecommendationBullets(card);
  const scenarioGuess = parseScenarioIntent(
    `${card.categoryLabel ?? ""} ${card.name} 추천`
  );
  const suggests = getNextSuggestions(scenarioGuess).slice(0, 3);

  const reservationPreview = getReservationPreviewForStore(card.id, card.category);
  const hamaPayEnabled = ENABLE_HAMA_PAY_UI && card.hama_pay_enabled === true;

  const goReserve = () => {
    router.push(`/reserve?${buildReserveQueryFromPlace({ storeId: card.id, name: card.name, card }).toString()}`);
  };

  const completeMockPayment = async () => {
    const loggedIn = typeof window !== "undefined" && window.localStorage.getItem("hamaLoggedIn") === "1";
    if (!loggedIn) {
      alert("로그인 후 참여 기록을 남길 수 있어요.");
      return;
    }
    if (payMockSaving) return;
    setPayMockSaving(true);
    try {
      const res = await fetch("/api/hama-pay/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: card.id,
          place_name: card.name,
          amount: null,
          context_json: {
            source_page: "place_detail",
            cta: "mock_payment",
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !json.ok) {
        alert("결제 완료 테스트 저장에 실패했어요. (테이블 미생성 상태일 수 있어요)");
        return;
      }
      logEvent("hama_pay_mock_completed", {
        place_id: card.id,
        place_name: card.name,
        source: "place_detail",
      });
      setFeedbackOpen(true);
    } catch (e) {
      console.error("[place detail mock pay] failed", e);
      alert("결제 완료 테스트 처리 중 오류가 발생했어요.");
    } finally {
      setPayMockSaving(false);
    }
  };

  const ensureBetaDecisionLog = async (): Promise<string | null> => {
    if (betaSelectedLogId) return betaSelectedLogId;
    const loggedIn = typeof window !== "undefined" && window.localStorage.getItem("hamaLoggedIn") === "1";
    if (!loggedIn) {
      alert("로그인 후 참여 기록을 남길 수 있어요.");
      return null;
    }
    try {
      const res = await fetch("/api/beta/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: card.id,
          place_name: card.name,
          recommendation_id: "place_detail",
          context_json: { source_page: "place_detail", page_id: card.id },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        selected_place_log_id?: string | null;
        selectedPlaceLogId?: string | null;
      };
      if (!res.ok || !json.ok) {
        alert("선택 기록 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return null;
      }
      const logId = (json.selected_place_log_id ?? json.selectedPlaceLogId ?? null) as string | null;
      setBetaSelectedLogId(logId);
      return logId;
    } catch (e) {
      console.error("[place detail beta decision] failed", e);
      alert("선택 기록 저장 중 오류가 발생했어요.");
      return null;
    }
  };

  const submitPlaceBetaVerification = async () => {
    if (betaSubmitting) return;
    if (!betaReceiptFile) {
      alert("영수증 사진을 첨부해 주세요.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(betaReceiptFile.type)) {
      alert("jpg/png/webp 파일만 업로드할 수 있어요.");
      return;
    }
    if (betaReceiptFile.size > 5 * 1024 * 1024) {
      alert("5MB 이하 파일만 업로드할 수 있어요.");
      return;
    }
    const logId = await ensureBetaDecisionLog();
    if (!logId) return;
    setBetaSubmitting(true);
    setBetaMessage(null);
    try {
      logEvent("receipt_verification_started", { source: "place_detail", selected_place_id: card.id });
      const res = await fetch("/api/beta/receipt-verify", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.set("selected_place_log_id", logId);
          fd.set("receipt_place_name", card.name);
          fd.set("receipt_image", betaReceiptFile);
          fd.set("feedback_tags", JSON.stringify(betaFeedbackTags));
          fd.set("feedback_text", betaFeedbackText.trim());
          return fd;
        })(),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setBetaMessage("인증 제출에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      logEvent("receipt_verification_submitted", { source: "place_detail", selected_place_id: card.id });
      setBetaSubmitted(true);
      setBetaVerifyOpen(false);
      setBetaMessage(json.message ?? "인증이 제출됐어요. 관리자가 확인 후 참여 횟수에 반영돼요.");
    } catch (e) {
      console.error("[place detail beta verify] failed", e);
      setBetaMessage("인증 제출 중 오류가 발생했어요.");
    } finally {
      setBetaSubmitting(false);
    }
  };

  const submitVisitFeedback = async (payload: VisitFeedbackPayload) => {
    if (feedbackSaving) return;
    setFeedbackSaving(true);
    try {
      const reqBody = {
        place_id: card.id,
        place_name: card.name,
        source: "hama_pay",
        satisfaction: payload.satisfaction,
        feedback_tags: Array.isArray(payload.feedback_tags) ? payload.feedback_tags : [],
        memo: typeof payload.memo === "string" && payload.memo.trim().length > 0 ? payload.memo.trim() : null,
      };
      console.log("[visit-feedback] request(place_detail):", reqBody);
      const res = await fetch("/api/visit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
      console.log("[visit-feedback] response(place_detail):", { status: res.status, ...json });
      if (!res.ok || !json.ok) {
        console.error("[visit-feedback] failed(place_detail):", { status: res.status, ...json, reqBody });
        alert(`피드백 저장에 실패했어요.\n${json.error ?? "unknown_error"}${json.detail ? `: ${json.detail}` : ""}`);
        return;
      }
      logEvent("visit_feedback_submitted", {
        place_id: card.id,
        place_name: card.name,
        source: "place_detail",
        satisfaction: payload.satisfaction,
        tags: payload.feedback_tags,
      });
      console.log("visit_feedback_saved");
      setFeedbackOpen(false);
    } catch (e) {
      console.error("[place detail visit feedback] failed", e);
      alert("피드백 저장 중 오류가 발생했어요.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 48, background: colors.bgDefault }}>
      <div style={{ height: 260, background: colors.bgMuted, position: "relative" }}>
        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.08) 42%, rgba(15,23,42,0.65) 100%)",
            pointerEvents: "none",
          }}
        />
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "none",
            background: "rgba(15,23,42,0.45)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
            backdropFilter: "blur(6px)",
          }}
        >
          ←
        </button>
      </div>

      <div style={{ padding: `0 ${space.pageX}px 24px`, marginTop: -32, position: "relative", zIndex: 2 }}>
        <div
          style={{
            borderRadius: radius.largeCard,
            background: `linear-gradient(135deg, ${colors.accentSoft} 0%, #fff7ed 100%)`,
            padding: "16px 18px",
            boxShadow: shadow.elevated,
            border: `1px solid ${colors.tagDeepBorder}`,
          }}
        >
          <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 700, letterSpacing: "0.04em" }}>
            왜 추천했는지
          </p>
          <p style={{ ...typo.cardReason, fontSize: 17, color: colors.reasonHot, margin: "8px 0 0", fontWeight: 900 }}>
            {reason.headline}
          </p>
          <p style={{ ...typo.body, color: colors.textSecondary, margin: "8px 0 0", lineHeight: 1.55 }}>{reason.subline}</p>
          {reason.regionTrust && (
            <p style={{ ...typo.caption, color: colors.textMuted, margin: "8px 0 0", fontSize: 12 }}>
              {reason.regionTrust}
            </p>
          )}
        </div>

        <h1 style={{ ...typo.cardTitle, fontSize: 22, margin: "20px 0 0", lineHeight: 1.25, fontWeight: 900 }}>
          {card.name}
        </h1>
        {hamaPayEnabled ? (
          <div
            style={{
              display: "inline-flex",
              marginTop: 8,
              borderRadius: 999,
              background: "#DCFCE7",
              color: "#166534",
              fontSize: 12,
              fontWeight: 900,
              padding: "6px 10px",
            }}
          >
            HAMA Pay 가능
          </div>
        ) : null}
        <p style={{ ...typo.caption, color: colors.textMuted, margin: "6px 0 0", fontWeight: 700 }}>상황 태그</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {reason.badges.map((t) => (
            <span
              key={t}
              style={{
                ...typo.chip,
                color: colors.tagDeepText,
                background: colors.tagDeepBg,
                padding: "6px 11px",
                borderRadius: radius.chip,
                border: `1px solid ${colors.tagDeepBorder}`,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <p style={{ ...typo.body, color: colors.textSecondary, marginTop: 14, fontWeight: 600 }}
        >
          {typeof card.distanceKm === "number" ? `${card.distanceKm.toFixed(1)}km · ` : ""}
          {bizKr(card)}
        </p>
        {card.address && (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 6 }}>
            {card.address}
          </p>
        )}

        <ReservationSummaryCard preview={reservationPreview} />

        <p style={{ ...typo.caption, color: colors.textMuted, margin: "14px 0 0", lineHeight: 1.45 }}>
          하마가 시간·예약금을 먼저 보여 주고, 바로 잡을 수 있게 이어줄게요.
        </p>

        <button
          type="button"
          onClick={() => {
            logEvent(HamaEvents.home_trust_reserve, { place_id: card.id, page: "place_detail", cta: "reserve_primary" });
            goReserve();
          }}
          style={{
            width: "100%",
            height: 54,
            marginTop: 14,
            borderRadius: radius.button,
            border: "none",
            background: colors.accentPrimary,
            color: colors.accentOnPrimary,
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          지금 예약하기
        </button>
        {hamaPayEnabled && SHOW_HAMA_PAY_MOCK ? (
          <button
            type="button"
            onClick={completeMockPayment}
            disabled={payMockSaving}
            style={{
              width: "100%",
              height: 50,
              marginTop: 10,
              borderRadius: radius.button,
              border: "none",
              background: payMockSaving ? "#86EFAC" : "#16A34A",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: payMockSaving ? "wait" : "pointer",
            }}
          >
            {payMockSaving ? "처리 중..." : "결제 완료 테스트"}
          </button>
        ) : null}

        <div style={{ display: "flex", gap: space.buttonGap, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.cta_directions,
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              const lat = typeof card.lat === "number" ? card.lat : null;
              const lng = typeof card.lng === "number" ? card.lng : null;
              openDirections({ name: card.name, lat, lng });
            }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.bgSurface,
              color: colors.textPrimary,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            길찾기
          </button>
          <button
            type="button"
            disabled={!tel}
            onClick={() => {
              logEvent(
                HamaEvents.cta_call,
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              window.location.href = `tel:${tel.replace(/[^0-9+]/g, "")}`;
            }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.bgSurface,
              fontWeight: 800,
              fontSize: 15,
              cursor: tel ? "pointer" : "not-allowed",
              opacity: tel ? 1 : 0.45,
            }}
          >
            전화하기
          </button>
        </div>

        <div style={{ display: "flex", gap: space.buttonGap, marginTop: 10 }}>
          <button
            type="button"
            onClick={async () => {
              const next = await toggleSaved(card.id);
              logEvent(HamaEvents.cta_save_toggle, {
                place_id: card.id,
                saved: next,
                page: "place_detail",
              });
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgMuted,
              color: colors.textPrimary,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {isSaved(card.id) ? "저장됨" : "저장해두기"}
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.external_place_open,
                mergeLogPayload(analyticsFromScenario(null), {
                  place_id: card.id,
                  provider: "naver",
                  page: "place_detail",
                })
              );
              openPlace(card, "naver");
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: colors.textSecondary,
            }}
          >
            네이버에서 보기
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.external_place_open,
                mergeLogPayload(analyticsFromScenario(null), {
                  place_id: card.id,
                  provider: "kakao",
                  page: "place_detail",
                })
              );
              openPlace(card, "kakao");
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: colors.textSecondary,
            }}
          >
            카카오맵에서 보기
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            background: "#F8FAFC",
            padding: "14px 16px",
            display: "grid",
            gap: 10,
          }}
        >
          {!betaVerifyOpen && !betaSubmitted ? (
            <>
              <div style={{ ...typo.cardTitle, fontSize: 15, margin: 0, fontWeight: 900 }}>영수증 인증</div>
              <div style={{ ...typo.caption, color: colors.textSecondary }}>
                하마 추천으로 방문했다면 영수증 사진을 올려주세요. 관리자가 확인 후 참여 횟수에 반영돼요.
              </div>
              <div style={{ ...typo.caption, color: colors.textSecondary }}>
                이 매장을 먼저 선택하면 인증할 수 있어요.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={async () => {
                    const logId = await ensureBetaDecisionLog();
                    if (!logId) return;
                    setBetaVerifyOpen(true);
                    setBetaSubmitted(false);
                    setBetaMessage(null);
                  }}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    border: "none",
                    background: "#1D4ED8",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    padding: "0 12px",
                    cursor: "pointer",
                  }}
                >
                  이 매장으로 결정 후 인증
                </button>
              </div>
            </>
          ) : null}

          {betaVerifyOpen && !betaSubmitted ? (
            <>
              <div style={{ ...typo.cardTitle, fontSize: 15, margin: 0, fontWeight: 900 }}>영수증 인증</div>
              <div style={{ ...typo.caption, color: colors.textSecondary }}>
                하마 추천으로 방문했다면 영수증 사진을 올려주세요. 관리자가 확인 후 참여 횟수에 반영돼요.
              </div>
              <div style={{ ...typo.caption, color: colors.textSecondary }}>
                개인정보가 보이지 않게 카드번호 일부나 전화번호는 가리고 올려주세요.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    setBetaReceiptFile(file);
                    setBetaReceiptPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return file ? URL.createObjectURL(file) : null;
                    });
                  }}
                  style={{ width: "100%", maxWidth: 360 }}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ ...typo.caption, color: colors.textPrimary, fontWeight: 900 }}>
                  방문 후 어땠나요? (선택)
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    "추천이 잘 맞았어요",
                    "분위기가 생각과 달랐어요",
                    "가족/아이와 가기 좋았어요",
                    "조용하고 편했어요",
                    "다시 방문하고 싶어요",
                  ].map((tag) => {
                    const active = betaFeedbackTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setBetaFeedbackTags((prev) =>
                            prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
                          )
                        }
                        style={{
                          height: 32,
                          borderRadius: 999,
                          border: active ? "1px solid #2563EB" : "1px solid #CBD5E1",
                          background: active ? "#EFF6FF" : "#fff",
                          color: active ? "#1D4ED8" : "#334155",
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "0 10px",
                          cursor: "pointer",
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={betaFeedbackText}
                  onChange={(e) => setBetaFeedbackText(e.target.value)}
                  placeholder="실제 방문해보니 어땠는지 간단히 남겨주세요 (선택)"
                  style={{
                    width: "100%",
                    minHeight: 72,
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    padding: "10px",
                    fontSize: 13,
                    background: "#fff",
                    resize: "vertical",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={submitPlaceBetaVerification}
                  disabled={betaSubmitting || !betaReceiptFile}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    border: "none",
                    background: betaSubmitting || !betaReceiptFile ? "#93C5FD" : "#1D4ED8",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    padding: "0 12px",
                    cursor: betaSubmitting ? "wait" : "pointer",
                  }}
                >
                  {betaSubmitting ? "제출 중..." : "영수증 인증 제출하기"}
                </button>
              </div>
              {betaReceiptFile ? (
                <div style={{ ...typo.caption, color: colors.textPrimary, fontWeight: 700 }}>
                  첨부 파일: {betaReceiptFile.name}
                </div>
              ) : null}
              {betaReceiptPreviewUrl ? (
                <img
                  src={betaReceiptPreviewUrl}
                  alt="영수증 미리보기"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    background: "#fff",
                  }}
                />
              ) : null}
            </>
          ) : null}

          {betaSubmitted ? (
            <>
              <div style={{ ...typo.cardTitle, fontSize: 15, margin: 0, fontWeight: 900 }}>인증 제출 완료</div>
              <div style={{ ...typo.caption, color: colors.textSecondary }}>
                관리자가 확인 후 참여 횟수에 반영돼요.
              </div>
              <div
                style={{
                  width: "fit-content",
                  borderRadius: 999,
                  border: "1px solid #BFDBFE",
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "4px 9px",
                }}
              >
                확인 대기
              </div>
            </>
          ) : null}

          {betaMessage ? <div style={{ ...typo.caption, color: colors.textPrimary }}>{betaMessage}</div> : null}
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>이런 이유로 추천했어요</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {bullets.map((b) => (
            <div
              key={b}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "12px 14px",
                borderRadius: radius.card,
                background: colors.bgSurface,
                border: `1px solid ${colors.borderSubtle}`,
                boxShadow: shadow.soft,
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1.2 }}>
                ✓
              </span>
              <p style={{ ...typo.body, margin: 0, color: colors.textPrimary, lineHeight: 1.5 }}>{b}</p>
            </div>
          ))}
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>매장 정보</h2>
        {card.description ? (
          <p style={{ ...typo.body, color: colors.textPrimary, marginTop: 10, lineHeight: 1.55 }}>{card.description}</p>
        ) : (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 10, lineHeight: 1.55 }}>
            메뉴와 최신 사진은 아래 링크에서 더 확인할 수 있어요. 자세한 리뷰와 사진은 외부 페이지에서도 볼 수 있어요.
          </p>
        )}

        {Array.isArray(card.menu_keywords) && card.menu_keywords.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "0 0 8px" }}>메뉴·키워드</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {card.menu_keywords.slice(0, 16).map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textSecondary,
                    background: colors.bgMuted,
                    padding: "5px 10px",
                    borderRadius: radius.pill,
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {((card.tags?.length ?? 0) > 0 || (card.mood?.length ?? 0) > 0) && (
          <div style={{ marginTop: 14 }}>
            <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "0 0 8px" }}>분위기·태그</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...(card.mood ?? []), ...(card.tags ?? [])]
                .filter(Boolean)
                .filter((t, i, a) => a.indexOf(t) === i)
                .slice(0, 20)
                .map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.textSecondary,
                      background: colors.bgMuted,
                      padding: "5px 10px",
                      borderRadius: radius.pill,
                    }}
                  >
                    {t}
                  </span>
                ))}
            </div>
          </div>
        )}

        {tel && (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 12 }}>{tel}</p>
        )}

        <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 14, lineHeight: 1.5 }}>
          {parkingHintFromCard(card) ??
            "주차 가능 여부는 매장마다 달라요. 네이버·카카오 플레이스에서 ‘주차’ 정보를 꼭 확인해 주세요."}
        </p>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>이어서 가기 좋아요</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {suggests.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/results?q=${encodeURIComponent(s.query)}`)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: radius.card,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.bgSurface,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: shadow.soft,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center" }}>{s.icon}</span>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <VisitFeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={submitVisitFeedback}
        submitting={feedbackSaving}
        placeName={card.name}
      />
    </main>
  );
}
