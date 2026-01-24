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
  const rawCategory = params.get("category"); // 탭/URL에서 넘어오는 값

  // 내 위치
  const myLat = Number(params.get("lat"));
  const myLng = Number(params.get("lng"));
  const hasMyLocation = Number.isFinite(myLat) && Number.isFinite(myLng);

  // ✅ 핵심: "종합"은 activeCategory = null
  // - category 파라미터가 없으면 => 종합(null)
  // - all/total/종합이면 => 종합(null)
  // - 그 외에만 매핑해서 카테고리 필터
  const activeCategory: Category | null = useMemo(() => {
    if (!rawCategory) return null;

    const t = String(rawCategory).trim();
    const tl = t.toLowerCase();

    if (tl === "all" || tl === "total" || t === "종합") return null;

    const mapped = mapUrlCategoryToCategory(t);
    if (mapped) return mapped;

    // 혹시 이상한 값이면(예: tab이 query만 바꾼 경우) 안전하게 "추론" fallback
    // 단, 이 fallback도 "종합" UX를 깨기 쉬우니까 rawCategory가 있을 때만 허용
    return inferCategoryFromQuery(query);
  }, [rawCategory, query]);

  // 데이터 로딩
  const { stores, loading } = useSearchStores();

  // 필터/정렬/페이지
  const { categoryStores, pages } = useCardPaging({
    stores: stores as any,
    activeCategory, // Category | null
    query,
    hasMyLocation,
    myLat,
    myLng,
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

  // ✅ “상태 리셋”을 query/category 변화가 아니라,
  //    실제 결과 집합 키가 바뀌었을 때만 수행해서 깜빡임 줄이기
  const resultKey = useMemo(() => {
    const catKey = activeCategory ?? "all";
    const locKey = hasMyLocation ? `${myLat.toFixed(5)},${myLng.toFixed(5)}` : "noloc";
    return `${query}__${catKey}__${locKey}`;
  }, [query, activeCategory, hasMyLocation, myLat, myLng]);

  // 결과가 바뀌면: page 0으로 보내고, 첫 카드로 selectedId 맞추기
  useEffect(() => {
    setPageIndex(0);
    setOverlayVisible(false);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();

    // safePages[0]가 생긴 뒤에 selectedId 세팅
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

  // ✅ 좌상단 디버그 패널 (항상 보이게)
  const DebugPanel = (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 99999,
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        fontSize: 12,
        lineHeight: 1.4,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        whiteSpace: "pre",
      }}
    >
      {[
        `loading: ${loading ? "true" : "false"}`,
        `query: ${JSON.stringify(query)}`,
        `rawCategory: ${JSON.stringify(rawCategory)}`,
        `activeCategory: ${JSON.stringify(activeCategory)}`,
        `stores: ${stores?.length ?? 0}`,
        `categoryStores: ${categoryStores?.length ?? 0}`,
        `pages: [${safePages.map((p) => p.length).join(", ")}]`,
        `pageIndex: ${pageIndex}`,
        `selectedId: ${JSON.stringify(selectedId)}`,
        `hasMyLocation: ${hasMyLocation ? "true" : "false"}`,
      ].join("\n")}
    </div>
  );

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
        {DebugPanel}
        불러오는 중...
      </main>
    );
  }

  // 여기서 categoryStores가 0이어도 SearchCards가 empty UI 보여주도록 이미 바꿨으니,
  // SearchPageClient에서 "결과가 없어요"로 일찍 리턴하지 않는다.
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
      {DebugPanel}

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
