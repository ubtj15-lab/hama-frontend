"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SearchCards from "./_components/SearchCards";
import SearchOverlay from "./_components/SearchOverlay";

import {
  inferCategoryFromQuery,
  mapUrlCategoryToCategory,
  type CardInfo,
  type Category,
} from "./_hooks/useSearchStores";

import { useSearchStores } from "./_hooks/useSearchStores";
import { useCardPaging } from "./_hooks/useCardPaging";
import { useRecent } from "../_hooks/useRecent";
import { useSaved } from "../_hooks/useSaved";
import { useUIOverlay } from "../_providers/UIOverlayProvider";

export default function SearchPageClient() {
  const router = useRouter();
  const params = useSearchParams();

  const query = params.get("query") || "";
  const rawCategory = params.get("category"); // 탭/URL에서 넘어오는 값

  // 내 위치
  const myLat = Number(params.get("lat"));
  const myLng = Number(params.get("lng"));
  const hasMyLocation = Number.isFinite(myLat) && Number.isFinite(myLng);

  // ✅ "종합"은 activeCategory = null
  const activeCategory: Category | null = useMemo(() => {
    const t = String(rawCategory ?? "").trim();
    const tl = t.toLowerCase();

    if (t && (tl === "all" || tl === "total" || t === "종합")) return null;

    if (rawCategory) {
      const mapped = mapUrlCategoryToCategory(t);
      if (mapped) return mapped;
    }

    // rawCategory 없고 query가 있으면 query로 추론 (중국집, 카페 등)
    if (query.trim()) return inferCategoryFromQuery(query);
    return null;
  }, [rawCategory, query]);

  // 데이터 로딩
  const { stores, loading } = useSearchStores();

  // 필터/정렬/페이지 (radiusKm 15km로 확대 - 3km면 결과 없을 수 있음)
  const { categoryStores, pages, usedChineseFallback } = useCardPaging({
    stores: stores as any,
    activeCategory, // Category | null
    query,
    hasMyLocation,
    myLat,
    myLng,
    radiusKm: 15,
  });

  // ✅ pages를 무조건 CardInfo[][] 로 안전 변환 (3페이지 고정)
  const safePages: CardInfo[][] = useMemo(() => {
    const p0 = Array.isArray(pages?.[0]) ? pages[0] : [];
    const p1 = Array.isArray(pages?.[1]) ? pages[1] : [];
    const p2 = Array.isArray(pages?.[2]) ? pages[2] : [];
    return [p0, p1, p2];
  }, [pages]);

  // 페이지 상태
  const [pageIndex, setPageIndex] = useState(0);
  const currentCards = safePages[pageIndex] ?? [];

  // 선택 상태
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 오버레이 상태
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const { recordView } = useRecent();
  const { toggleSaved, isSaved } = useSaved();
  const { setOverlayOpen } = useUIOverlay();
  useEffect(() => {
    setOverlayOpen(overlayVisible);
  }, [overlayVisible, setOverlayOpen]);

  // 예약 상태
  const [reserveStep, setReserveStep] = useState<0 | 1 | 2>(0);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);

  const resetReserve = () => {
    setReserveStep(0);
    setReserveDate(null);
    setReserveTime(null);
  };

  // 스와이프
  const touchStartXRef = useRef<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );

  // ✅ selected / others
  const selected: CardInfo | null = useMemo(() => {
    if (selectedId) {
      const found = currentCards.find((c) => c.id === selectedId);
      if (found) return found;
    }
    return currentCards[0] ?? null;
  }, [currentCards, selectedId]);

  const others: CardInfo[] = useMemo(() => {
    if (!selected) return currentCards;
    return currentCards.filter((c) => c.id !== selected.id);
  }, [currentCards, selected]);

  // ✅ 결과 집합 키
  const resultKey = useMemo(() => {
    const catKey = activeCategory ?? "all";
    const locKey = hasMyLocation
      ? `${myLat.toFixed(5)},${myLng.toFixed(5)}`
      : "noloc";
    return `${query}__${catKey}__${locKey}`;
  }, [query, activeCategory, hasMyLocation, myLat, myLng]);

  // 결과가 바뀌면: page 0 + 첫 카드 + 오버레이 닫기
  useEffect(() => {
    setPageIndex(0);

    setOverlayVisible(false);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();

    const first = safePages[0]?.[0];
    setSelectedId(first?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  // 페이지 이동
  const goToPage = (index: number) => {
    if (index < 0 || index >= safePages.length) return;
    const nextCards = safePages[index];
    if (!nextCards || nextCards.length === 0) return;

    setPageIndex(index);
    setSelectedId(nextCards[0].id);

    setOverlayVisible(false);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();
  };

  // 길안내
  const goToMap = (card: CardInfo) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("hama_search_last_id", card.id);
    }
    const lat = card.lat ?? "";
    const lng = card.lng ?? "";
    router.push(
      `/map?q=${encodeURIComponent(card.name)}&lat=${encodeURIComponent(
        String(lat)
      )}&lng=${encodeURIComponent(String(lng))}`
    );
  };

  // 카카오 장소
  const openKakaoPlace = (card: CardInfo) => {
    const url = `https://map.kakao.com/?q=${encodeURIComponent(card.name)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // 예약 버튼
  const handleReserveClick = () => {
    setDetailOpen(false);

    if (reserveStep === 0) {
      setReserveStep(1);
      return;
    }
    if (reserveStep === 1) {
      if (!reserveDate || !reserveTime) {
        alert("날짜와 시간을 먼저 선택해 주세요 🙂");
        return;
      }
      setReserveStep(2);
      return;
    }
    if (reserveStep === 2) {
      resetReserve();
    }
  };

  const handleRate = () =>
    alert("평점 기능은 추후 버전에서 제공될 예정입니다!");
  const handleDetailClick = () => {
    resetReserve();
    setDetailOpen((prev) => !prev);
  };

  // 카드 확대 열기/닫기
  const openExpanded = (id: string) => {
    setSelectedId(id);
    recordView(id);
    setDetailOpen(false);
    resetReserve();

    setExpanded(false);
    setOverlayVisible(true);
    setTimeout(() => setExpanded(true), 10);
  };

  const closeExpanded = () => {
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();
    setTimeout(() => setOverlayVisible(false), 280);
  };

  const handleOverlayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!detailOpen && reserveStep === 0 && e.currentTarget.scrollTop > 40) {
      closeExpanded();
    }
  };

  // 스와이프
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    if (startX == null) return;

    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;
    const threshold = 40;

    if (diff > threshold) {
      if (pageIndex > 0 && (safePages[pageIndex - 1]?.length ?? 0) > 0) {
        setSwipeDirection("right");
        goToPage(pageIndex - 1);
        setTimeout(() => setSwipeDirection(null), 220);
      }
    } else if (diff < -threshold) {
      if (
        pageIndex < safePages.length - 1 &&
        (safePages[pageIndex + 1]?.length ?? 0) > 0
      ) {
        setSwipeDirection("left");
        goToPage(pageIndex + 1);
        setTimeout(() => setSwipeDirection(null), 220);
      }
    }

    touchStartXRef.current = null;
  };

  // ✅ map에서 돌아오면 복구
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedId = window.sessionStorage.getItem("hama_search_last_id");
    if (!savedId) return;

    const foundIndex = safePages.findIndex((p) =>
      p.some((c) => c.id === savedId)
    );
    if (foundIndex === -1) {
      window.sessionStorage.removeItem("hama_search_last_id");
      return;
    }

    setPageIndex(foundIndex);
    setSelectedId(savedId);

    setOverlayVisible(true);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();

    setTimeout(() => setExpanded(true), 10);
    window.sessionStorage.removeItem("hama_search_last_id");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePages]);

  // 로딩
  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#eef5fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        불러오는 중...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        paddingTop: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      {/* 기본 카드 UI */}
      {!overlayVisible && (
        <SearchCards
          query={query}
          hasMyLocation={hasMyLocation}
          usedChineseFallback={usedChineseFallback}
          pageIndex={pageIndex}
          pages={safePages}
          selected={selected}
          others={others}
          swipeDirection={swipeDirection}
          onBack={() => router.push("/")}
          onOpenExpanded={openExpanded}
          onOpenKakaoPlace={openKakaoPlace}
          onGoToPage={goToPage}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* 오버레이 */}
      <SearchOverlay
        visible={overlayVisible}
        expanded={expanded}
        detailOpen={detailOpen}
        reserveStep={reserveStep}
        reserveDate={reserveDate}
        reserveTime={reserveTime}
        selected={selected}
        onClose={closeExpanded}
        onOpenKakaoPlace={openKakaoPlace}
        onGoToMap={goToMap}
        onReserveClick={handleReserveClick}
        onRate={handleRate}
        onToggleDetail={handleDetailClick}
        onOverlayScroll={handleOverlayScroll}
        setReserveDate={(v) => setReserveDate(v)}
        setReserveTime={(v) => setReserveTime(v)}
        isSaved={isSaved}
        onToggleSaved={toggleSaved}
      />
    </main>
  );
}
