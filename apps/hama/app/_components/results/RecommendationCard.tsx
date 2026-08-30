"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { logRecommendationPlace } from "@/lib/analytics/recommendationPlaceLog";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { scenarioRankKeyForRecommendationCopy } from "@/lib/scenarioEngine/scenarioRankBridge";
import { getCategoryImage } from "@/lib/categoryImages";
import {
  buildRecommendationReason,
  getClientTimeOfDay,
  type RecommendationReasonBlock,
} from "@/lib/recommend/buildRecommendationReason";
import { Touchable } from "@ui/Touchable";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";
import { pickVisitPlacePhotosFromFileList, VISIT_PLACE_PHOTO_ACCEPT } from "@/lib/visitPlacePhotoClient";
import {
  DECISION_BUTTON_COPY,
  DECISION_BUTTON_SELECTED_COPY,
  IMAGE_REFERENCE_LABEL,
  PRIMARY_PICK_LABEL,
  RESULTS_PURPLE,
  RESULTS_PURPLE_SOFT,
  conversationalReasonFromBlock,
  essentialFacts,
  hoursStatusLabel,
  oneLineReasonFromBlock,
} from "./resultsPresentation";

/** 예약 CTA는 `@/lib/reservationUiFlags`의 SHOW_RESERVATION_UI로 제어. 이 카드에는 예약 전용 UI 없음. */

const ENABLE_HAMA_PAY_UI = process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY === "true";
const SHOW_HAMA_PAY_MOCK =
  ENABLE_HAMA_PAY_UI &&
  (process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY_MOCK === "true");

type Props = {
  card: HomeCard;
  rank: number;
  scenarioObject: ScenarioObject | null;
  reason?: RecommendationReasonBlock;
  showSoftFallbackCopy?: boolean;
  analyticsV2Click?: LogRecommendationEventInput["analytics_v2"];
  onCardClick: () => void;
  onChooseHere?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onNavigate: () => void;
  onCall: () => void;
  selected?: boolean;
  hamaPayEnabled?: boolean;
  onMockPayment?: () => void;
  mockPaymentBusy?: boolean;
  showVerificationEntry?: boolean;
  showVisitVerification?: boolean;
  verificationExpanded?: boolean;
  verificationSubmitted?: boolean;
  receiptFileName?: string | null;
  receiptPreviewUrl?: string | null;
  /** 방문 사진 — 제출 주체(RecommendationList)와 동일 배열을 쓰도록 상위에서 전달 */
  visitPhotos?: File[];
  visitFeedbackTags?: string[];
  visitFeedbackText?: string;
  receiptVerifying?: boolean;
  receiptResult?: string | null;
  onReceiptFileChange?: (file: File | null) => void;
  onVisitPhotosChange?: (files: File[]) => void;
  onToggleVisitFeedbackTag?: (tag: string) => void;
  onVisitFeedbackTextChange?: (value: string) => void;
  onToggleVerification?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSubmitVerification?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onResetSelection?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function RecommendationCard({
  card,
  rank,
  scenarioObject,
  reason: reasonOverride,
  analyticsV2Click,
  onCardClick,
  onChooseHere,
  onNavigate,
  selected = false,
  hamaPayEnabled,
  onMockPayment,
  mockPaymentBusy = false,
  showVerificationEntry = true,
  showVisitVerification = false,
  verificationExpanded = false,
  verificationSubmitted = false,
  receiptFileName = null,
  receiptPreviewUrl = null,
  visitPhotos = [],
  visitFeedbackTags = [],
  visitFeedbackText = "",
  receiptVerifying = false,
  receiptResult = null,
  onReceiptFileChange,
  onVisitPhotosChange,
  onToggleVisitFeedbackTag,
  onVisitFeedbackTextChange,
  onToggleVerification,
  onSubmitVerification,
  onResetSelection,
}: Props) {
  const feedbackTagOptions = [
    "추천이 잘 맞았어요",
    "분위기가 생각과 달랐어요",
    "가족/아이와 가기 좋았어요",
    "조용하고 편했어요",
    "다시 방문하고 싶어요",
  ] as const;
  const cardEl = useRef<HTMLDivElement>(null);
  const impressOnce = useRef(false);
  const rankOrder = rank + 1;
  const isTop = rankOrder === 1;
  const [postVisitOpen, setPostVisitOpen] = useState(false);
  const [reasonShimmerActive, setReasonShimmerActive] = useState(true);
  const [visitPhotoPreviewUrls, setVisitPhotoPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = visitPhotos.map((f) => URL.createObjectURL(f));
    setVisitPhotoPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [visitPhotos]);

  useEffect(() => {
    if (selected && showVisitVerification) {
      setPostVisitOpen(true);
    }
  }, [selected, showVisitVerification]);

  useEffect(() => {
    if (!reasonShimmerActive) return;
    const t = window.setTimeout(() => setReasonShimmerActive(false), 8200);
    return () => window.clearTimeout(t);
  }, [reasonShimmerActive]);

  useLayoutEffect(() => {
    if (impressOnce.current || !cardEl.current) return;
    const el = cardEl.current;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !impressOnce.current) {
          impressOnce.current = true;
          logRecommendationPlace("place_impression", card, scenarioObject, {
            rank_position: rank,
            source_page: "results",
            analytics_v2: analyticsV2Click,
          });
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [card.id, rank, scenarioObject, analyticsV2Click, card]);

  const requestedScenario = scenarioRankKeyForRecommendationCopy(scenarioObject);
  const reason =
    reasonOverride ??
    buildRecommendationReason(card, {
      deckSlot: rank,
      timeOfDay: getClientTimeOfDay(),
      requestedScenario,
    });

  const realImage =
    (card as any).imageUrl ??
    (card as any).image_url ??
    (card as any).thumbnail_url ??
    (card as any).photo_url ??
    (card as any).main_image_url;
  const displayImage = realImage || getCategoryImage(card.category ?? undefined, card.id || card.name);

  const teaser = oneLineReasonFromBlock(reason);
  const why = conversationalReasonFromBlock(reason);
  const facts = essentialFacts(card);
  const hours = hoursStatusLabel(card);
  const isHamaPayEnabled = ENABLE_HAMA_PAY_UI && (hamaPayEnabled ?? (card.hama_pay_enabled === true));

  return (
    <Touchable>
      <article
        ref={cardEl}
        role="button"
        tabIndex={0}
        onClick={() => {
          logRecommendationPlace("place_click", card, scenarioObject, {
            rank_position: rank,
            source_page: "results",
            metadata: { selected_rank: rank },
            analytics_v2: {
              ...analyticsV2Click,
              action: "click",
              selected_place_id: card.id,
            },
          });
          onCardClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardClick();
          }
        }}
        style={{
          borderRadius: isTop ? 28 : 20,
          background: isTop ? "#fff" : "#FFFCF8",
          padding: isTop ? 0 : 12,
          border: isTop ? `1.5px solid ${RESULTS_PURPLE_SOFT}` : "1px solid #EFE8DE",
          boxShadow: isTop ? "0 10px 28px rgba(107, 77, 230, 0.1)" : "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {isTop ? (
          <div>
            <div className="hama-top1-hero">
              <img
                src={displayImage}
                alt={card.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.onerror = null;
                  target.src = "/images/category/default-1.jpg";
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  borderRadius: 999,
                  background: RESULTS_PURPLE,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "6px 10px",
                }}
              >
                ✨ {PRIMARY_PICK_LABEL}
              </span>
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 10,
                  borderRadius: 999,
                  background: "rgba(26,26,26,0.55)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 8px",
                }}
              >
                {IMAGE_REFERENCE_LABEL}
              </span>
            </div>
            <div style={{ padding: "16px 16px 14px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 6vw, 28px)",
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "#1A1A1A",
                  wordBreak: "keep-all",
                }}
              >
                {card.name}
              </h3>
              {teaser ? (
                <p
                  className="hama-reason-shimmer-wrap"
                  data-shimmer={reasonShimmerActive ? "on" : "off"}
                  style={{
                    margin: "10px 0 0",
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.45,
                    color: RESULTS_PURPLE,
                    fontStyle: "italic",
                  }}
                >
                  {teaser}
                </p>
              ) : null}
              {facts.length ? (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13, fontWeight: 700, color: "#5F5E5A" }}>
                  {facts.map((fact) => (
                    <span key={fact}>
                      {fact === facts[0] && card.distanceKm != null ? `📍 ${fact}` : fact}
                    </span>
                  ))}
                </div>
              ) : null}
              {hours.unverified ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "#9A958C" }}>{hours.label}</p>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: "#5F5E5A" }}>{hours.label}</p>
              )}
              {isHamaPayEnabled ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    borderRadius: 999,
                    background: "#DCFCE7",
                    color: "#166534",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "5px 10px",
                  }}
                >
                  HAMA Pay 가능
                </div>
              ) : null}
              {why ? (
                <div style={{ marginTop: 14, borderRadius: 16, background: "#F7F3FF", padding: "12px 14px" }}>
                  <div
                    style={{
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      color: RESULTS_PURPLE,
                      fontStyle: "italic",
                    }}
                  >
                    하마가 고른 이유
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#2A2A2A", lineHeight: 1.45 }}>{why}</p>
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate();
                  }}
                  style={{
                    minHeight: 48,
                    borderRadius: 14,
                    border: "1px solid #E8E0D4",
                    background: "#fff",
                    color: "#1A1A1A",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  길찾기
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onChooseHere) onChooseHere(e);
                    else onCardClick();
                  }}
                  style={{
                    minHeight: 48,
                    borderRadius: 14,
                    border: "none",
                    background: selected ? "#16A34A" : RESULTS_PURPLE,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {selected ? DECISION_BUTTON_SELECTED_COPY : DECISION_BUTTON_COPY}
                </button>
              </div>
              {showVerificationEntry || isHamaPayEnabled ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPostVisitOpen((prev) => !prev);
                    }}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      minHeight: 36,
                      border: "none",
                      background: "transparent",
                      color: "#9A958C",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    방문 후 인증/피드백 {postVisitOpen ? "▴" : "▾"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              <div style={{ position: "relative", width: 88, minHeight: 88, flexShrink: 0, borderRadius: 14, overflow: "hidden", background: "#F1F5F9" }}>
                <img
                  src={displayImage}
                  alt={card.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = "/images/category/default-1.jpg";
                  }}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#1A1A1A",
                    wordBreak: "keep-all",
                  }}
                >
                  {card.name}
                </h3>
                {teaser ? (
                  <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "#6B4DE6", lineHeight: 1.4, fontStyle: "italic" }}>
                    {teaser}
                  </p>
                ) : null}
                {facts.length ? (
                  <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: "#8A857C" }}>{facts.join(" · ")}</p>
                ) : null}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate();
                }}
                style={{
                  minHeight: 42,
                  borderRadius: 12,
                  border: "1px solid #E8E0D4",
                  background: "#fff",
                  color: "#1A1A1A",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                길찾기
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onChooseHere) onChooseHere(e);
                  else onCardClick();
                }}
                style={{
                  minHeight: 42,
                  borderRadius: 12,
                  border: "none",
                  background: selected ? "#16A34A" : "#2A2A2A",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {selected ? DECISION_BUTTON_SELECTED_COPY : DECISION_BUTTON_COPY}
              </button>
            </div>
            {showVerificationEntry || isHamaPayEnabled ? (
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPostVisitOpen((prev) => !prev);
                  }}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    minHeight: 32,
                    border: "none",
                    background: "transparent",
                    color: "#B0AAA3",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  방문 후 인증/피드백 {postVisitOpen ? "▴" : "▾"}
                </button>
              </div>
            ) : null}
          </div>
        )}
        {postVisitOpen && selected && isHamaPayEnabled ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: "1px solid #BBF7D0",
              background: "#F0FDF4",
              padding: "10px 12px",
              display: "grid",
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
              방문 후 HAMA Pay로 결제하면 자동으로 참여 기록돼요
            </div>
            {SHOW_HAMA_PAY_MOCK ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMockPayment?.();
                }}
                disabled={mockPaymentBusy}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: mockPaymentBusy ? "#86EFAC" : "#16A34A",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: mockPaymentBusy ? "wait" : "pointer",
                }}
              >
                {mockPaymentBusy ? "처리 중..." : "결제 완료 테스트"}
              </button>
            ) : null}
          </div>
        ) : null}
        {postVisitOpen && showVerificationEntry ? (
          <div
            style={{
              marginTop: 16,
              width: "100%",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              background: "#F8FAFC",
              padding: "14px 16px",
              display: "grid",
              gap: 10,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {!showVisitVerification ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>영수증 인증</div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  하마 추천으로 방문했다면 영수증 사진을 올려주세요. 관리자가 확인 후 참여 횟수에 반영돼요.
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  이 매장을 먼저 선택하면 인증할 수 있어요.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleVerification?.(e);
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
            {showVisitVerification && !verificationExpanded && !verificationSubmitted ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>영수증 인증</div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  하마 추천으로 방문했다면 영수증 사진을 올려주세요. 관리자가 확인 후 참여 횟수에 반영돼요.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleVerification?.(e);
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
                    영수증 인증하기
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResetSelection?.(e);
                    }}
                    style={{
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      background: "#fff",
                      color: "#334155",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "0 12px",
                      cursor: "pointer",
                    }}
                  >
                    다시 고르기
                  </button>
                </div>
              </>
            ) : null}

            {showVisitVerification && verificationExpanded && !verificationSubmitted ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>영수증 인증</div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  하마 추천으로 방문했다면 영수증 사진을 올려주세요. 관리자가 확인 후 참여 횟수에 반영돼요.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0] ?? null;
                      onReceiptFileChange?.(file);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ width: "100%", maxWidth: 360 }}
                  />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                    방문 후 어땠나요? (선택)
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {feedbackTagOptions.map((tag) => {
                      const active = visitFeedbackTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleVisitFeedbackTag?.(tag);
                          }}
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
                    value={visitFeedbackText}
                    onChange={(e) => onVisitFeedbackTextChange?.(e.target.value)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
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
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                    방문 사진 (선택, 최대 3장 · jpg/png/webp · 장당 5MB)
                  </div>
                  <input
                    type="file"
                    name="visit_place_photos"
                    accept={VISIT_PLACE_PHOTO_ACCEPT}
                    multiple
                    onChange={(e) => {
                      console.log("[HAMA_FILE_INPUT_ONCHANGE]", {
                        fileCount: e.currentTarget.files?.length ?? 0,
                        files: Array.from(e.currentTarget.files ?? []).map((f) => ({
                          name: f.name,
                          type: f.type,
                          size: f.size,
                        })),
                      });
                      const list = e.currentTarget.files;
                      const picked = pickVisitPlacePhotosFromFileList(list);
                      onVisitPhotosChange?.(picked);
                      e.currentTarget.value = "";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ width: "100%", maxWidth: 360 }}
                  />
                  {visitPhotoPreviewUrls.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {visitPhotoPreviewUrls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid #CBD5E1",
                            background: "#fff",
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSubmitVerification?.(e);
                    }}
                    disabled={receiptVerifying || !receiptFileName}
                    style={{
                      height: 38,
                      borderRadius: 10,
                      border: "none",
                      background: receiptVerifying || !receiptFileName ? "#93C5FD" : "#1D4ED8",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "0 12px",
                      cursor: receiptVerifying ? "wait" : "pointer",
                    }}
                  >
                    {receiptVerifying ? "제출 중..." : "영수증 인증 제출하기"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResetSelection?.(e);
                    }}
                    style={{
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      background: "#fff",
                      color: "#334155",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "0 12px",
                      cursor: "pointer",
                    }}
                  >
                    다시 고르기
                  </button>
                </div>
                {receiptFileName ? (
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>
                    첨부 파일: {receiptFileName}
                  </div>
                ) : null}
                {receiptPreviewUrl ? (
                  <img
                    src={receiptPreviewUrl}
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
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  개인정보가 보이지 않게 카드번호 일부나 전화번호는 가리고 올려주세요.
                </div>
              </>
            ) : null}

            {showVisitVerification && verificationSubmitted ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>인증 제출 완료</div>
                <div style={{ fontSize: 12, color: "#475569" }}>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResetSelection?.(e);
                    }}
                    style={{
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      background: "#fff",
                      color: "#334155",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "0 12px",
                      cursor: "pointer",
                    }}
                  >
                    다시 고르기
                  </button>
                </div>
              </>
            ) : null}

            {showVisitVerification && receiptResult && verificationExpanded ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{receiptResult}</div>
            ) : null}
          </div>
        ) : null}
      </article>
      <style jsx>{`
        .hama-top1-hero {
          position: relative;
          height: clamp(188px, 48vw, 240px);
          background: #F1F5F9;
        }

        @media (min-width: 720px) {
          .hama-top1-hero {
            height: 176px;
          }
        }

        .hama-reason-shimmer-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
        }

        .hama-reason-shimmer-wrap[data-shimmer="on"]::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: -110%;
          width: 62%;
          pointer-events: none;
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 252, 233, 0.42) 40%,
            rgba(255, 255, 255, 0.48) 52%,
            rgba(255, 248, 220, 0.32) 66%,
            rgba(255, 255, 255, 0) 100%
          );
          mix-blend-mode: screen;
          animation: hamaReasonSweepOverlay 2.8s ease-in-out 2;
          will-change: left, opacity;
        }

        @keyframes hamaReasonSweepOverlay {
          0% {
            left: -110%;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hama-reason-shimmer-wrap[data-shimmer="on"]::after {
            animation: none;
            display: none;
          }
        }

        @media (min-width: 720px) {
          .hama-top1-hero {
            height: 176px !important;
          }
        }
      `}</style>
    </Touchable>
  );
}
