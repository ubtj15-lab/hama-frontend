"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { logRecommendationPlace } from "@/lib/analytics/recommendationPlaceLog";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { scenarioRankKeyForRecommendationCopy } from "@/lib/scenarioEngine/scenarioRankBridge";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
import { getCategoryImage } from "@/lib/categoryImages";
import {
  buildRecommendationReason,
  getClientTimeOfDay,
  type RecommendationReasonBlock,
} from "@/lib/recommend/buildRecommendationReason";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { Chip } from "@ui/Chip";
import { Touchable } from "@ui/Touchable";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";

const ENABLE_HAMA_PAY_UI = process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY === "true";
const SHOW_HAMA_PAY_MOCK =
  ENABLE_HAMA_PAY_UI &&
  (process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_HAMA_PAY_MOCK === "true");

function bizLabel(s: BusinessState): string {
  switch (s) {
    case "OPEN":
      return "영업 중";
    case "LAST_ORDER_SOON":
      return "라스트오더 임박";
    case "BREAK":
      return "브레이크타임";
    case "CLOSED":
      return "영업 종료";
    default:
      return "영업 정보 확인";
  }
}

function kmLine(card: HomeCard): string {
  const km = card.distanceKm;
  if (typeof km === "number" && Number.isFinite(km)) return `${km.toFixed(1)}km`;
  return "거리 확인 필요";
}

function crowdFromReason(reason: RecommendationReasonBlock): string {
  const t = `${reason.liveStatusLine ?? ""} ${reason.subline ?? ""} ${reason.badges.join(" ")}`;
  if (/여유|한산|안\s?붐빔/.test(t)) return "여유 있어요";
  if (/혼잡|붐빔|대기/.test(t)) return "약간 붐벼요";
  return "확인 필요";
}

function crowdColor(crowd: string): string {
  return crowd.includes("여유") ? "#2F9E44" : crowd.includes("붐") ? "#F08C00" : colors.textSecondary;
}

function normalizeShortSentence(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/g, "")
    .trim();
}

function splitReasonLines(lines: string[]): string[] {
  return lines
    .flatMap((line) => String(line).split(/[·.]/))
    .map((line) => normalizeShortSentence(line))
    .filter(Boolean)
    .map((line) => (line.length > 28 ? `${line.slice(0, 28)}…` : line))
    .slice(0, 3);
}

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
  visitFeedbackTags?: string[];
  visitFeedbackText?: string;
  receiptVerifying?: boolean;
  receiptResult?: string | null;
  onReceiptFileChange?: (file: File | null) => void;
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
  visitFeedbackTags = [],
  visitFeedbackText = "",
  receiptVerifying = false,
  receiptResult = null,
  onReceiptFileChange,
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

  const openStatus = bizLabel(businessStateFromCard(card));
  const crowdStatus = crowdFromReason(reason);
  const cleanReasons = splitReasonLines([reason.headline, reason.subline, ...reason.badges]);
  const visibleTags = (card.tags ?? []).map((t) => normalizeShortSentence(String(t))).filter(Boolean).slice(0, 3);
  const fallbackTags = visibleTags.length ? visibleTags : reason.badges.slice(0, 3);

  const scenarioLine = useMemo(() => {
    const first = String(reason.scenarioLabel ?? "")
      .split("\n")
      .map((v) => normalizeShortSentence(v))
      .find(Boolean);
    return first || "지금 가기 편해요";
  }, [reason.scenarioLabel]);
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
          borderRadius: 24,
          background: "#fff",
          padding: 16,
          border: isTop ? "2px solid #F97316" : "1px solid #F1F5F9",
          boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
          position: "relative",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  borderRadius: 999,
                  background: isTop ? "#F97316" : "#F1F5F9",
                  color: isTop ? "#fff" : "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "6px 12px",
                }}
              >
                추천 {rankOrder}순위
              </span>
              {isTop ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "#F97316" }}>🔥 지금 여기 기준 최적!</span>
              ) : null}
            </div>

            <div style={{ marginBottom: 6, fontSize: 15, fontWeight: 800, color: "#F97316", wordBreak: "keep-all" }}>
              {scenarioLine}
            </div>

            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(24px, 4.8vw, 36px)",
                lineHeight: 1.1,
                fontWeight: 900,
                color: "#020617",
                wordBreak: "keep-all",
              }}
            >
              {card.name}
            </h3>

            <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: 15, fontWeight: 700, color: "#334155" }}>
              <span>🚶 {kmLine(card)}</span>
              <span>🕒 {openStatus}</span>
              <span style={{ color: crowdColor(crowdStatus) }}>👥 {crowdStatus}</span>
            </div>
            {isHamaPayEnabled ? (
              <div
                style={{
                  marginBottom: 10,
                  display: "inline-flex",
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

            <div style={{ marginBottom: 12, borderRadius: 16, background: "rgba(255,237,213,0.6)", padding: "10px 12px" }}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 900, color: "#F97316" }}>✨ 추천 이유</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                {cleanReasons.map((line, idx) => (
                  <li key={`${line}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, fontWeight: 700, color: "#1F2937", lineHeight: 1.35 }}>
                    <span
                      style={{
                        marginTop: 2,
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        background: "#F97316",
                        color: "#fff",
                        fontSize: 10,
                        display: "inline-grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {fallbackTags.map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative", height: "clamp(128px, 24vw, 176px)", borderRadius: 16, overflow: "hidden", background: "#F1F5F9" }}>
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
              <div
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.7)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "4px 10px",
                }}
              >
                실제 매장 참고 이미지 ⓘ
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate();
                }}
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid #E2E8F0",
                  background: "#fff",
                  color: "#0F172A",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                📍 길찾기
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
                  height: 46,
                  borderRadius: 14,
                  border: "none",
                  background: selected ? "#16A34A" : "#111827",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {selected ? "선택 완료" : "여기로 결정"}
              </button>
            </div>
            {selected && isHamaPayEnabled ? (
              <div
                style={{
                  marginTop: 8,
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
          </div>
        </div>
        {showVerificationEntry ? (
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
    </Touchable>
  );
}
