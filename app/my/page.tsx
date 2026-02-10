"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSaved } from "../_hooks/useSaved";
import { useRecent } from "../_hooks/useRecent";
import type { HomeCard } from "@/lib/storeTypes";

function getImageUrl(card: HomeCard): string {
  const c = card as Record<string, unknown>;
  return (c.imageUrl ?? c.image ?? c.image_url ?? "/images/category/restaurant.jpg") as string;
}

export default function MyPage() {
  const router = useRouter();
  const { savedCards, loading: savedLoading, toggleSaved, isSaved, refetch: refetchSaved } = useSaved();
  const { recentCards, loading: recentLoading, recordView, refetch: refetchRecent } = useRecent();

  const handleCardClick = async (card: HomeCard) => {
    await recordView(card.id);
    router.push(`/?open=${encodeURIComponent(card.id)}`);
  };

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
                      background: "#111827",
                    }}
                  >
                    <Image
                      src={getImageUrl(card)}
                      alt={card.name ?? ""}
                      fill
                      style={{ objectFit: "cover" }}
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
                      background: "#111827",
                    }}
                  >
                    <Image
                      src={getImageUrl(card)}
                      alt={card.name ?? ""}
                      fill
                      style={{ objectFit: "cover" }}
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
