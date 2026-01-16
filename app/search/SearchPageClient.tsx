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

export default function SearchPageClient() {
  const router = useRouter();
  const params = useSearchParams();

  const query = params.get("query") || "";
  const rawCategory = params.get("category");

  // 내 위치
  const myLat = Number(params.get("lat"));
  const myLng = Number(params.get("lng"));
  const hasMyLocation = Number.isFinite(myLat) && Number.isFinite(myLng);

  // 카테고리 결정
  const paramCategory = mapUrlCategoryToCategory(rawCategory);
  const activeCategory: Category = paramCategory ?? inferCategoryFromQuery(query);

  // 데이터 로딩
  const { stores, loading } = useSearchStores();

  useEffect(() => {
    console.log("DEBUG loading:", loading, "stores:", stores?.length);
    if (!stores || stores.length === 0) return;

    const byRaw: Record<string, number> = {};
    const byNorm: Record<string, number> = {};

    for (const s of stores) {
      const raw = String((s as any).category ?? "");
      const norm = String((s as any).categoryNorm ?? "");
      byRaw[raw] = (byRaw[raw] ?? 0) + 1;
      byNorm[norm] = (byNorm[norm] ?? 0) + 1;
    }

    console.log("RAW category counts:", byRaw);
    console.log("NORM category counts:", byNorm);
    console.table(byRaw);
    console.table(byNorm);
  }, [loading, stores]);

  // 필터/정렬/페이지
  const { categoryStores, pages } = useCardPaging({
    stores,
    activeCategory,
    query,
    hasMyLocation,
    myLat,
    myLng,
  });

  // ✅ pages를 무조건 CardInfo[][] 로 “안전 변환”
  const safePages: CardInfo[][] = useMemo(() => {
    if (!Array.isArray(pages)) return [[], [], []];
    const normalized = pages.map((p) => (Array.isArray(p) ? p : []));
    return [normalized[0] ?? [], normalized[1] ?? [], normalized[2] ?? []];
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

  // 예약 상태
  const [reserveStep, setReserveStep] = useState<0 | 1 | 2>(0);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);

  // 스와이프
  const touchStartXRef = useRef<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );

  // 현재 selected / others
  const selected: CardInfo | null =
    (currentCards.find((c) => c.id === selectedId) ?? currentCards[0] ?? null) ||
    null;

  const others: CardInfo[] = selected
    ? currentCards.filter((c) => c.id !== selected.id)
    : currentCards;

  const resetReserve = () => {
    setReserveStep(0);
    setReserveDate(null);
    setReserveTime(null);
  };

  // 페이지 이동
  const goToPage = (index: number) => {
    if (index < 0 || index >= safePages.length) return;
    const nextCards = safePages[index];
    if (!nextCards || !nextCards.length) return;

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

  const handleRate = () => alert("평점 기능은 추후 버전에서 제공될 예정입니다!");
  const handleDetailClick = () => {
    resetReserve();
    setDetailOpen((prev) => !prev);
  };

  // 카드 확대 열기/닫기
  const openExpanded = (id: string) => {
    setSelectedId(id);
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

  // 첫 렌더에서 selectedId 세팅
  useEffect(() => {
    if (!selectedId && currentCards.length > 0) {
      setSelectedId(currentCards[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, currentCards.length]);

  // 검색/카테고리 바뀌면 page 0으로 리셋
  useEffect(() => {
    setPageIndex(0);
    setSelectedId(null);
    setOverlayVisible(false);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory]);

  // ✅ map에서 돌아오면 복구
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedId = window.sessionStorage.getItem("hama_search_last_id");
    if (!savedId) return;

    const foundIndex = safePages.findIndex((p) => p.some((c) => c.id === savedId));
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

  // 로딩/빈 결과
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

  if (!categoryStores.length) {
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
        결과가 없어요
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
      />
    </main>
  );
}
