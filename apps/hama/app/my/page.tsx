"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSaved } from "../_hooks/useSaved";
import { useRecent } from "../_hooks/useRecent";
import type { HomeCard } from "@/lib/storeTypes";
import { getDefaultCardImage } from "@/lib/defaultCardImage";

function thumbSrc(card: HomeCard): string {
  const c = card as Record<string, unknown>;
  const u = String(c.imageUrl ?? c.image ?? c.image_url ?? "").trim();
  if (u) return u;
  return getDefaultCardImage(card);
}

export default function MyPage() {
  const router = useRouter();
  const { savedCards, loading: savedLoading, toggleSaved, isSaved, refetch: refetchSaved } = useSaved();
  const { recentCards, loading: recentLoading, recordView, refetch: refetchRecent } = useRecent();
  const [betaVisitCount, setBetaVisitCount] = React.useState(0);
  const [betaRewarded, setBetaRewarded] = React.useState(false);
  const [betaLoaded, setBetaLoaded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/beta/state", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; visit_count?: number; is_rewarded?: boolean };
        if (!alive || !res.ok || !json.ok) return;
        setBetaVisitCount(Number(json.visit_count ?? 0));
        setBetaRewarded(json.is_rewarded === true);
      } catch {
      } finally {
        if (alive) setBetaLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleCardClick = async (card: HomeCard) => {
    await recordView(card.id);
    router.push(`/?open=${encodeURIComponent(card.id)}`);
  };

  const betaLine = React.useMemo(() => {
    if (betaRewarded || betaVisitCount >= 3) return "🎉 3/3 완료! 커피 지급 대상입니다";
    if (betaVisitCount === 2) return "2/3 완료, 한 번만 더 하면 커피 지급 대상이에요";
    if (betaVisitCount === 1) return "1/3 완료 👍";
    return "이번 달 AI 추천 실험 참여 중";
  }, [betaRewarded, betaVisitCount]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "24px 16px 40px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 14px",
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← 뒤로
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
            마이
          </h1>
          <div style={{ width: 56 }} />
        </header>
        <section style={{ marginBottom: 20 }}>
          <div
            style={{
              marginBottom: 10,
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              background: "#fff",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>베타 진행도</div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
              {betaLoaded ? betaLine : "불러오는 중..."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/onboarding?return_to=%2Fmy")}
            style={{
              width: "100%",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: "12px 14px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            추천 설문 수정하기
          </button>
        </section>

        {/* 저장한 카드 */}
        <section style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#64748b",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            저장한 카드
          </h2>
          {savedLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              불러오는 중...
            </div>
          ) : savedCards.length === 0 ? (
            <div
              style={{
                padding: 24,
                background: "#ffffff",
                borderRadius: 16,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              }}
            >
              저장한 카드가 없어요.
              <br />
              홈이나 검색에서 ♡를 눌러 저장해 보세요!
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {savedCards.map((card) => (
                <div
                  key={card.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#ffffff",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    cursor: "pointer",
                  }}
                  onClick={() => handleCardClick(card)}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      position: "relative",
                      background: "#e2e8f0",
                    }}
                  >
                    <img
                      src={thumbSrc(card)}
                      alt=""
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = getDefaultCardImage(card);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: "12px 0" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {card.categoryLabel ?? card.category ?? ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaved(card.id);
                      refetchSaved();
                    }}
                    style={{
                      marginRight: 12,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 20,
                      color: isSaved(card.id) ? "#f43f5e" : "#cbd5e1",
                    }}
                  >
                    {isSaved(card.id) ? "♥" : "♡"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 최근 본 카드 */}
        <section>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#64748b",
              marginBottom: 12,
            }}
          >
            최근 본 카드
          </h2>
          {recentLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              불러오는 중...
            </div>
          ) : recentCards.length === 0 ? (
            <div
              style={{
                padding: 24,
                background: "#ffffff",
                borderRadius: 16,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              }}
            >
              최근 본 카드가 없어요.
              <br />
              홈이나 검색에서 카드를 눌러보세요!
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {recentCards.map((card) => (
                <div
                  key={card.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#ffffff",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    cursor: "pointer",
                  }}
                  onClick={() => handleCardClick(card)}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      position: "relative",
                      background: "#e2e8f0",
                    }}
                  >
                    <img
                      src={thumbSrc(card)}
                      alt=""
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = getDefaultCardImage(card);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: "12px 12px 12px 0" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {card.categoryLabel ?? card.category ?? ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaved(card.id);
                      refetchSaved();
                      refetchRecent();
                    }}
                    style={{
                      marginRight: 12,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 20,
                      color: isSaved(card.id) ? "#f43f5e" : "#cbd5e1",
                    }}
                  >
                    {isSaved(card.id) ? "♥" : "♡"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
