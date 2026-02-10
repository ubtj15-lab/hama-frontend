"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Store = { id: string; name: string | null; category: string | null; area: string | null };

type Period = "today" | "7d" | "30d";

type StorePhoto = { id: string; image_url: string; sort_order: number; created_at: string };
type StoreMenu = {
  id: string;
  name: string;
  price: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

type Stats = {
  store_id: string;
  store_name: string | null;
  store_category: string | null;
  cover_image_url?: string | null;
  period?: Period;
  period_label?: string;
  card_views: number;
  naver_clicks: number;
  kakao_clicks: number;
  detail_actions: number;
  search_clicks: number;
  saved_count: number;
  recent_views_count: number;
  total_clicks: number;
  today_card_views?: number;
  today_saved_count?: number;
  today_recent_views_count?: number;
  today_total_clicks?: number;
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
  const [period, setPeriod] = useState<Period>("today");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [menus, setMenus] = useState<StoreMenu[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [menusLoading, setMenusLoading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuDesc, setMenuDesc] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageSaving, setCoverImageSaving] = useState(false);
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

  const fetchStats = useCallback(
    async (id: string, periodOverride?: Period) => {
      if (!id.trim()) return;
      const p = periodOverride ?? period;
      setSelectedStoreId(id.trim());
      setStatsLoading(true);
      setError(null);
      setStats(null);
      setShowResults(false);
      try {
        const res = await fetch(
          `/api/partner/stats?store_id=${encodeURIComponent(id.trim())}&period=${p}`,
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
  },
    [period]
  );

  useEffect(() => {
    if (storeIdFromUrl) {
      fetchStats(storeIdFromUrl);
    }
  }, [storeIdFromUrl, fetchStats]);

  const prevPeriodRef = useRef<Period>(period);
  useEffect(() => {
    if (prevPeriodRef.current !== period && selectedStoreId) {
      prevPeriodRef.current = period;
      fetchStats(selectedStoreId, period);
    } else {
      prevPeriodRef.current = period;
    }
  }, [period, selectedStoreId, fetchStats]);

  const fetchPhotos = useCallback(async (storeId: string) => {
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/partner/stores/${storeId}/photos`, { credentials: "include" });
      const data = await res.json();
      setPhotos(res.ok ? (data.photos ?? []) : []);
    } catch {
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  }, []);

  const fetchMenus = useCallback(async (storeId: string) => {
    setMenusLoading(true);
    try {
      const res = await fetch(`/api/partner/stores/${storeId}/menus`, { credentials: "include" });
      const data = await res.json();
      setMenus(res.ok ? (data.menus ?? []) : []);
    } catch {
      setMenus([]);
    } finally {
      setMenusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchPhotos(selectedStoreId);
      fetchMenus(selectedStoreId);
    } else {
      setPhotos([]);
      setMenus([]);
    }
  }, [selectedStoreId, fetchPhotos, fetchMenus]);

  const handleSelectStore = (store: Store) => {
    setSearchQuery(store.name ?? "");
    fetchStats(store.id);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
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
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              border: "none",
              cursor: "pointer",
            }}
          >
            ← 뒤로
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
            매장주 대시보드
          </h1>
          <div style={{ width: 56 }} />
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
                      이 검색어로 연결된 매장이 없어요. 매장 연결은 관리자에게 문의해 주세요.
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
            본인에게 연결된 매장만 검색돼요. 매장 연결은 관리자에게 문의해 주세요.
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

        {/* 통계 카드 - 기간 선택 → 매장 → 4개 지표 → 상세 클릭 → 오늘 요약 */}
        {stats && !statsLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 기간 필터 */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["today", "7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: period === p ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: period === p ? "#EFF6FF" : "#ffffff",
                    color: period === p ? "#1d4ed8" : "#64748b",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  {p === "today" ? "오늘" : p === "7d" ? "7일" : "30일"}
                </button>
              ))}
            </div>

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

            <div style={{ fontSize: 12, color: "#64748b", marginBottom: -4 }}>
              기간: {stats.period_label ?? "오늘"}
            </div>
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

            {/* 오늘 요약 - 스크린샷 아래에 배치 */}
            <div
              style={{
                padding: 18,
                background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                borderRadius: 16,
                boxShadow: "0 4px 16px rgba(37,99,235,0.12)",
                border: "1px solid #93C5FD",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1d4ed8", marginBottom: 14 }}>
                📊 오늘 요약
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                }}
              >
                {[
                  { label: "카드 열람", value: stats.today_card_views ?? 0, color: "#2563eb" },
                  { label: "저장", value: stats.today_saved_count ?? 0, color: "#16a34a" },
                  { label: "최근 조회", value: stats.today_recent_views_count ?? 0, color: "#7c3aed" },
                  { label: "외부 클릭", value: stats.today_total_clicks ?? 0, color: "#dc2626" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                      {item.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
                오늘 0시(한국시간) 기준
              </div>
            </div>

            {/* 매장 사진 & 메뉴 */}
            <div
              style={{
                padding: 18,
                background: "#ffffff",
                borderRadius: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 16 }}>
                📷 매장 사진 & 메뉴
              </div>

              {/* 대표 이미지 (추천 카드에 노출) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  대표 이미지 (홈 추천 카드에 표시돼요)
                </div>
                {stats.cover_image_url && (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 280,
                      aspectRatio: "16/10",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#f1f5f9",
                      marginBottom: 10,
                    }}
                  >
                    <img
                      src={stats.cover_image_url}
                      alt="대표"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="url"
                    placeholder="대표 이미지 주소 입력"
                    value={coverImageUrl !== "" ? coverImageUrl : (stats.cover_image_url ?? "")}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    style={{
                      flex: "1 1 200px",
                      minWidth: 0,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    disabled={coverImageSaving}
                    onClick={async () => {
                      if (!selectedStoreId) return;
                      const url = (coverImageUrl !== "" ? coverImageUrl : (stats.cover_image_url ?? "")).trim();
                      setCoverImageSaving(true);
                      try {
                        const res = await fetch(
                          `/api/partner/stores/${selectedStoreId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              cover_image_url: url || null,
                            }),
                          }
                        );
                        const data = await res.json();
                        if (res.ok) {
                          setStats((prev) =>
                            prev ? { ...prev, cover_image_url: data.cover_image_url ?? null } : null
                          );
                          setCoverImageUrl("");
                        }
                      } finally {
                        setCoverImageSaving(false);
                      }
                    }}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: coverImageSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {coverImageSaving ? "저장 중…" : "저장"}
                  </button>
                  {stats.cover_image_url && (
                    <button
                      type="button"
                      disabled={coverImageSaving}
                      onClick={async () => {
                        if (!selectedStoreId) return;
                        setCoverImageSaving(true);
                        try {
                          const res = await fetch(
                            `/api/partner/stores/${selectedStoreId}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ cover_image_url: null }),
                            }
                          );
                          const data = await res.json();
                          if (res.ok) {
                            setStats((prev) =>
                              prev ? { ...prev, cover_image_url: data.cover_image_url ?? null } : null
                            );
                            setCoverImageUrl("");
                          }
                        } finally {
                          setCoverImageSaving(false);
                        }
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        color: "#64748b",
                        fontSize: 14,
                        cursor: coverImageSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>

              {/* 사진 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  사진
                </div>
                {photosLoading && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>불러오는 중...</div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        position: "relative",
                        width: 80,
                        height: 80,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#f1f5f9",
                      }}
                    >
                      <img
                        src={p.image_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedStoreId) return;
                          await fetch(
                            `/api/partner/stores/${selectedStoreId}/photos/${p.id}`,
                            { method: "DELETE", credentials: "include" }
                          );
                          fetchPhotos(selectedStoreId);
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "none",
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          fontSize: 14,
                          cursor: "pointer",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    placeholder="이미지 주소 입력"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedStoreId || !photoUrlInput.trim()) return;
                      const res = await fetch(
                        `/api/partner/stores/${selectedStoreId}/photos`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ image_url: photoUrlInput.trim() }),
                        }
                      );
                      if (res.ok) {
                        setPhotoUrlInput("");
                        fetchPhotos(selectedStoreId);
                      }
                    }}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 메뉴 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  메뉴
                </div>
                {menusLoading && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>불러오는 중...</div>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0" }}>
                  {menus.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        marginBottom: 6,
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, marginRight: 8 }}>{m.name}</span>
                        {m.price && (
                          <span style={{ color: "#64748b", fontSize: 13 }}>{m.price}</span>
                        )}
                        {m.description && (
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                            {m.description}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedStoreId) return;
                          await fetch(
                            `/api/partner/stores/${selectedStoreId}/menus/${m.id}`,
                            { method: "DELETE", credentials: "include" }
                          );
                          fetchMenus(selectedStoreId);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          background: "#fff",
                          color: "#dc2626",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="메뉴 이름"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="가격 (예: 8,000원)"
                    value={menuPrice}
                    onChange={(e) => setMenuPrice(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="설명 (선택)"
                    value={menuDesc}
                    onChange={(e) => setMenuDesc(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedStoreId || !menuName.trim()) return;
                      const res = await fetch(
                        `/api/partner/stores/${selectedStoreId}/menus`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            name: menuName.trim(),
                            price: menuPrice.trim() || undefined,
                            description: menuDesc.trim() || undefined,
                          }),
                        }
                      );
                      if (res.ok) {
                        setMenuName("");
                        setMenuPrice("");
                        setMenuDesc("");
                        fetchMenus(selectedStoreId);
                      }
                    }}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#16a34a",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    메뉴 추가
                  </button>
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
              본인에게 연결된 매장만 보입니다. 매장 등록·연결은 관리자에게 문의해 주세요.
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
