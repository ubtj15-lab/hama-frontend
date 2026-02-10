"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Store = { id: string; name: string | null; category: string | null; area: string | null };

type Stats = {
  store_id: string;
  store_name: string | null;
  store_category: string | null;
  card_views: number;
  naver_clicks: number;
  kakao_clicks: number;
  detail_actions: number;
  search_clicks: number;
  saved_count: number;
  recent_views_count: number;
  total_clicks: number;
} | null;

const SEARCH_DEBOUNCE_MS = 300;

function PartnerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeIdFromUrl = searchParams.get("store_id");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Store[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [stats, setStats] = useState<Stats>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchStores = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/partner/stores?q=${encodeURIComponent(q)}&limit=15`,
        { credentials: "include" }
      );
      if (res.status === 401) {
        setSearchResults([]);
        setError("로그인이 필요해요");
        return;
      }
      const data = await res.json();
      setSearchResults(data.stores ?? []);
      setError(null);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchStores(searchQuery);
    }, searchQuery.trim().length > 0 ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchStores]);

  const fetchStats = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setStatsLoading(true);
    setError(null);
    setStats(null);
    setShowResults(false);
    try {
      const res = await fetch(
        `/api/partner/stats?store_id=${encodeURIComponent(id.trim())}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.status === 401) {
        setError("로그인이 필요해요");
        return;
      }
      if (res.status === 403) {
        setError("이 매장의 통계를 볼 권한이 없어요");
        return;
      }
      if (!res.ok) {
        setError(data.error || "통계를 불러올 수 없어요");
        return;
      }
      setStats(data);
    } catch {
      setError("통계를 불러오는 중 오류가 발생했어요");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeIdFromUrl) {
      fetchStats(storeIdFromUrl);
    }
  }, [storeIdFromUrl, fetchStats]);

  const handleSelectStore = (store: Store) => {
    setSearchQuery(store.name ?? "");
    fetchStats(store.id);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
        paddingBottom: 40,
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 999,
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              textDecoration: "none",
            }}
          >
            ← 홈으로
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
            매장주 대시보드
          </h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
              border: "none",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#f1f5f9",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </header>

        {/* 매장 검색 */}
        <div
          ref={searchContainerRef}
          style={{ marginBottom: 24, position: "relative" }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="매장명 검색"
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  background: "#ffffff",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                  boxSizing: "border-box",
                }}
              />
              {showResults && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    maxHeight: 280,
                    overflowY: "auto",
                    background: "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                    zIndex: 100,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {searchLoading ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      검색 중...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      검색 결과가 없어요
                    </div>
                  ) : (
                    searchResults.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => handleSelectStore(store)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#111827",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{store.name}</div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 2,
                          }}
                        >
                          {store.category ?? ""}
                          {store.area ? ` · ${store.area}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 8,
            }}
          >
            매장명을 입력하면 검색할 수 있어요
          </div>
        </div>

        {statsLoading && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "#64748b",
              fontSize: 14,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
            }}
          >
            통계를 불러오는 중...
          </div>
        )}

        {error && error !== "로그인이 필요해요" && (
          <div
            style={{
              padding: 16,
              background: "#fef2f2",
              borderRadius: 12,
              color: "#b91c1c",
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* 통계 카드 */}
        {stats && !statsLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {stats.store_name && (
              <div
                style={{
                  padding: 16,
                  background: "#ffffff",
                  borderRadius: 16,
                  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  매장
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                  {stats.store_name}
                </div>
                {stats.store_category && (
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    {stats.store_category}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {[
                { label: "카드 상세 열람", value: stats.card_views, color: "#2563eb" },
                { label: "저장 수", value: stats.saved_count, color: "#16a34a" },
                { label: "최근 조회 수", value: stats.recent_views_count, color: "#7c3aed" },
                { label: "외부 링크 클릭", value: stats.total_clicks, color: "#dc2626" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 16,
                    background: "#ffffff",
                    borderRadius: 16,
                    boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: item.color,
                    }}
                  >
                    {item.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 16,
                background: "#ffffff",
                borderRadius: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>
                상세 클릭
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>네이버 링크</span>
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>
                    {stats.naver_clicks}회
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>카카오 링크</span>
                  <span style={{ fontWeight: 700, color: "#facc15" }}>
                    {stats.kakao_clicks}회
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>길안내/예약 버튼</span>
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>
                    {stats.detail_actions}회
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>검색 추천 클릭</span>
                  <span style={{ fontWeight: 700, color: "#7c3aed" }}>
                    {stats.search_clicks}회
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error === "로그인이 필요해요" && (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
              매장주 대시보드는 로그인 후 이용할 수 있어요.
            </div>
            <button
              type="button"
              onClick={() => (window.location.href = "/api/auth/kakao/login?return_to=/partner")}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                background: "#FEE500",
                color: "#111827",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              카카오 로그인
            </button>
          </div>
        )}

        {!stats && !statsLoading && !error && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 14,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
            }}
          >
            매장명을 검색해서 선택해보세요.
            <br />
            <span style={{ fontSize: 12, marginTop: 8, display: "block" }}>
              매장 등록은 관리자에게 문의해 주세요.
            </span>
          </div>
        )}
      </div>
    </main>
  );
}

export default function PartnerPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8FAFC",
            fontFamily: "Noto Sans KR, system-ui, sans-serif",
          }}
        >
          로딩 중...
        </div>
      }
    >
      <PartnerPageContent />
    </Suspense>
  );
}
