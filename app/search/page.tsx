"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import storesData from "../../data/stores";

/** 매장 타입 (stores.js 구조와 동일) */
type Store = {
  id: string;
  name: string;
  category: "cafe" | "restaurant" | "beauty";
  lat: number;
  lng: number;
  image: string;
  intro: string;
  rating: number;
  address: string;
};

type CardInfo = Store;

/** 🔹 URL의 category 값을 Store.category로 변환 */
function mapUrlCategoryToStoreCategory(
  c: string | null
): Store["category"] | null {
  if (!c) return null;

  if (c === "cafe" || c === "restaurant" || c === "beauty") return c;

  switch (c) {
    case "CE7":
      return "cafe";
    case "FD6":
      return "restaurant";
    case "BK9":
      return "beauty";
    default:
      return null;
  }
}

/** 카테고리 → 한글 라벨 */
function labelOfCategory(category: Store["category"]): string {
  if (category === "cafe") return "카페";
  if (category === "restaurant") return "식당";
  if (category === "beauty") return "미용실";
  return category;
}

/** 버튼 라벨 결정 */
function getDetailButtonLabel(place: CardInfo | null): string {
  if (!place) return "정보";
  if (place.category === "beauty") return "시술";
  if (place.category === "cafe" || place.category === "restaurant")
    return "메뉴";
  return "정보";
}

/** 매장별 상세 정보 (데모용) */
type StoreDetail = {
  title: string;
  tagline: string;
  hours: string;
  highlight: string;
  menu: { name: string; note?: string }[];
};

const STORE_DETAILS: Record<string, StoreDetail> = {
  // 예시만 하나 넣어둘게 (필요하면 더 채워도 되고, 안 채워도 동작엔 문제 없음)
  cafe_01: {
    title: "블루문 커피랩 시그니처 메뉴",
    tagline: "원두 향 좋은 분위기 좋은 카페",
    hours: "매일 10:00 ~ 22:00",
    highlight: "라떼 아트가 인기!",
    menu: [
      { name: "블루문 라떼", note: "시그니처" },
      { name: "콜드브루", note: "산미가 부드러운 스타일" },
      { name: "수제 케이크", note: "매일 메뉴 변경" },
    ],
  },
};

export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();

  const query = params.get("query") || "";
  const rawCategory = params.get("category");

  const stores = storesData as Store[];

  const inferCategoryFromQuery = (q: string): Store["category"] => {
    const t = q.toLowerCase();

    if (t.includes("미용") || t.includes("헤어") || t.includes("뷰티")) {
      return "beauty";
    }

    if (
      t.includes("식당") ||
      t.includes("밥") ||
      t.includes("한식") ||
      t.includes("레스토랑")
    ) {
      return "restaurant";
    }

    return "cafe";
  };

  const paramCategory = mapUrlCategoryToStoreCategory(rawCategory);
  const activeCategory: Store["category"] =
    paramCategory ?? inferCategoryFromQuery(query);

  /** 2) 선택된 카테고리 매장만 모으기 */
  const categoryStores = stores.filter((s) => s.category === activeCategory);

  /** 3) 카테고리 안에서 3개씩 3페이지 (최대 9개) */
  const pages: CardInfo[][] = [
    categoryStores.slice(0, 3),
    categoryStores.slice(3, 6),
    categoryStores.slice(6, 9),
  ];

  /** 4) 페이지 인덱스 */
  const [pageIndex, setPageIndex] = useState(0);

  /** 스와이프 애니메이션 방향 */
  const [swipeDirection, setSwipeDirection] = useState<
    "left" | "right" | null
  >(null);
  const touchStartXRef = useRef<number | null>(null);

  /** 현재 페이지 카드 목록 */
  const currentCards = pages[pageIndex] ?? [];

  /** 선택된 카드 ID */
  const [selectedId, setSelectedId] = useState<string>(
    currentCards[0]?.id ?? pages[0]?.[0]?.id ?? ""
  );

  /** 오버레이 / 확대 상태 */
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  /** 상세(메뉴/시술) 패널 열림 여부 */
  const [detailOpen, setDetailOpen] = useState(false);

  /** 예약 플로우 상태 */
  const [reserveStep, setReserveStep] = useState<0 | 1 | 2>(0);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);

  const selected =
    currentCards.find((c) => c.id === selectedId) ?? currentCards[0];
  const others = currentCards.filter((c) => c.id !== selected?.id);

  const detail = selected ? STORE_DETAILS[selected.id] : undefined;

  /** 페이지 점 클릭 */
  const goToPage = (index: number) => {
    if (index < 0 || index >= pages.length) return;
    const nextCards = pages[index];
    if (!nextCards.length) return;

    setPageIndex(index);
    setSelectedId(nextCards[0].id);
    setOverlayVisible(false);
    setExpanded(false);
    setDetailOpen(false);
    resetReserve();
  };

  /** 길안내 페이지로 이동 (+ 확대 상태 기억) */
  const goToMap = (card: CardInfo) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("hama_search_last_id", card.id);
    }

    router.push(
      `/map?q=${encodeURIComponent(card.name)}&lat=${card.lat}&lng=${card.lng}`
    );
  };

  /** 예약 버튼 눌렀을 때 */
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

  const handleRate = () => {
    alert("평점 기능은 추후 버전에서 제공될 예정입니다!");
  };

  /** 메뉴 / 시술 버튼 */
  const handleDetailClick = () => {
    resetReserve();
    setDetailOpen((prev) => !prev);
  };

  const detailLabel = getDetailButtonLabel(selected || null);

  /** 카드 클릭 → 확대 모드 */
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

  /** 스크롤로 닫기 (패널 열려 있으면 안 닫힘) */
  const handleOverlayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!detailOpen && reserveStep === 0 && e.currentTarget.scrollTop > 40) {
      closeExpanded();
    }
  };

  const resetReserve = () => {
    setReserveStep(0);
    setReserveDate(null);
    setReserveTime(null);
  };

  /** 날짜/시간 더미 옵션 */
  const dateOptions = [
    { label: "오늘", value: "오늘" },
    { label: "내일", value: "내일" },
    { label: "모레", value: "모레" },
  ];

  const timeOptions = ["11:00", "13:00", "15:00", "17:00", "19:00"];

  /** 🔙 길안내에서 돌아왔을 때 확대 상태 복구 */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedId = window.sessionStorage.getItem("hama_search_last_id");
    if (!savedId) return;

    const foundIndex = pages.findIndex((page) =>
      page.some((c) => c.id === savedId)
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
  }, [query, activeCategory]); // 검색어나 카테고리가 바뀔 때만 체크

  /** 👉 스와이프 핸들러 (모바일 제스처) */
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
      // 오른쪽으로 밀기 → 이전 페이지
      if (pageIndex > 0 && pages[pageIndex - 1].length) {
        setSwipeDirection("right");
        goToPage(pageIndex - 1);
        setTimeout(() => setSwipeDirection(null), 220);
      }
    } else if (diff < -threshold) {
      // 왼쪽으로 밀기 → 다음 페이지
      if (pageIndex < pages.length - 1 && pages[pageIndex + 1].length) {
        setSwipeDirection("left");
        goToPage(pageIndex + 1);
        setTimeout(() => setSwipeDirection(null), 220);
      }
    }

    touchStartXRef.current = null;
  };

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
      {/* 상단 바 (검색 결과 표시용) - 확대 모드일 땐 숨김 */}
      {!overlayVisible && (
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            marginTop: 0,
            maxHeight: 60,
            opacity: 1,
            transform: "translateY(0)",
            transition:
              "opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease, margin-top 0.3s ease",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => router.push("/")}
            style={{
              border: "none",
              background: "#ffffff",
              borderRadius: 12,
              padding: "8px 10px",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
              cursor: "pointer",
            }}
          >
            ⬅️
          </button>

          <div
            style={{
              flex: 1,
              marginLeft: 8,
              padding: "8px 12px",
              borderRadius: 9999,
              background: "#ffffff",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
              fontSize: 13,
              color: "#4b5563",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {query ? `“${query}” 검색 결과` : "하마 추천 장소"}
          </div>
        </div>
      )}

      {/* 기본 화면: 큰 카드 + 작은 카드 2개 (페이지 별) */}
      {!overlayVisible && selected && (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            transform:
              swipeDirection === "left"
                ? "translateX(-16px)"
                : swipeDirection === "right"
                ? "translateX(16px)"
                : "translateX(0)",
            transition: "transform 0.22s ease-out",
          }}
        >
          {/* 큰 카드 */}
          <div
            onClick={() => openExpanded(selected.id)}
            style={{
              width: 316,
              height: 269,
              borderRadius: 24,
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
              cursor: "pointer",
            }}
          >
            <Image
              src={selected.image}
              alt={selected.name}
              fill
              sizes="316px"
              style={{ objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                padding: "6px 10px",
                borderRadius: 9999,
                background: "rgba(15,23,42,0.75)",
                color: "#f9fafb",
                fontSize: 12,
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
              }}
            >
              {selected.name} · {labelOfCategory(selected.category)}
            </div>
          </div>

          {/* 작은 카드 2개 */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
            }}
          >
            {others.map((card) => (
              <div
                key={card.id}
                onClick={() => openExpanded(card.id)}
                style={{
                  width: 156,
                  height: 165,
                  borderRadius: 24,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
                  cursor: "pointer",
                }}
              >
                <Image
                  src={card.image}
                  alt={card.name}
                  fill
                  sizes="156px"
                  style={{ objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 10,
                    bottom: 10,
                    padding: "4px 8px",
                    borderRadius: 9999,
                    background: "rgba(15,23,42,0.75)",
                    color: "#f9fafb",
                    fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    fontSize: 11,
                  }}
                >
                  {card.name}
                </div>
              </div>
            ))}
          </div>

          {/* 페이지 점 3개 */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "none",
                  cursor: pages[i].length ? "pointer" : "default",
                  background: pages[i].length
                    ? i === pageIndex
                      ? "#2563eb"
                      : "rgba(148,163,184,0.7)"
                    : "rgba(209,213,219,0.8)",
                  transform:
                    i === pageIndex && pages[i].length
                      ? "scale(1.2)"
                      : "scale(1)",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                aria-label={`페이지 ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 🔥 확대 모드 + 애니메이션 */}
      {overlayVisible && selected && (
        <div
          onScroll={handleOverlayScroll}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(15,23,42,0.75)",
            backdropFilter: "blur(6px)",
            overflowY: "auto",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.28s ease",
          }}
        >
          {/* 흐릿한 아래 카드 두 장 */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            {others.slice(0, 2).map((card, index) => {
              const expandedTransform = `translateX(-50%) scale(${
                index === 0 ? 1.05 : 0.9
              }) rotate(${index === 0 ? "-2deg" : "2deg"})`;
              const collapsedTransform =
                "translateX(-50%) scale(0.8) translateY(40px)";
              return (
                <div
                  key={card.id}
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: expanded
                      ? expandedTransform
                      : collapsedTransform,
                    bottom: expanded
                      ? index === 0
                        ? "12%"
                        : "22%"
                      : "0%",
                    width: index === 0 ? "55%" : "44%",
                    height: index === 0 ? "18%" : "16%",
                    borderRadius: 20,
                    overflow: "hidden",
                    filter: "blur(18px)",
                    opacity: expanded ? 0.25 : 0,
                    transition:
                      "opacity 0.3s ease, transform 0.3s ease, bottom 0.3s ease",
                  }}
                >
                  <Image
                    src={card.image}
                    alt={card.name}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
              );
            })}
          </div>

          {/* 내용 영역 */}
          <div
            style={{
              minHeight: "100vh",
              padding: "24px 12px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* 메인 큰 카드 */}
            <div
              style={{
                width: "100%",
                maxWidth: 430,
                height: "calc(100vh - 150px)",
                borderRadius: 26,
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 14px 40px rgba(0, 0, 0, 0.55)",
                background: "#000",
                opacity: expanded ? 1 : 0,
                transform: expanded
                  ? "translateY(0) scale(1)"
                  : "translateY(40px) scale(0.95)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              <Image
                src={selected.image}
                alt={selected.name}
                fill
                sizes="430px"
                style={{ objectFit: "cover" }}
              />

              {/* 뒤로가기 버튼 */}
              <button
                onClick={closeExpanded}
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  width: 32,
                  height: 32,
                  borderRadius: "9999px",
                  border: "none",
                  background: "rgba(15,23,42,0.8)",
                  color: "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                }}
              >
                ←
              </button>

              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 18,
                  padding: "6px 12px",
                  borderRadius: 9999,
                  background: "rgba(15,23,42,0.8)",
                  color: "#f9fafb",
                  fontSize: 13,
                  fontFamily: "Noto Sans KR, system-ui, sans-serif",
                }}
              >
                {selected.name} · {labelOfCategory(selected.category)}
              </div>
            </div>

            {/* 버튼 4개 */}
            <div
              style={{
                width: "100%",
                maxWidth: 430,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 14,
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateY(0)" : "translateY(24px)",
                transition:
                  "opacity 0.3s ease 0.03s, transform 0.3s ease 0.03s",
              }}
            >
              {[
                {
                  label:
                    reserveStep === 0
                      ? "예약"
                      : reserveStep === 1
                      ? "예약 확정"
                      : "다른 시간 예약",
                  onClick: handleReserveClick,
                },
                { label: "길안내", onClick: () => goToMap(selected) },
                { label: "평점", onClick: handleRate },
                { label: detailLabel, onClick: handleDetailClick },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 9999,
                    padding: "9px 0",
                    background: "#f3f4f6",
                    fontSize: 13,
                    fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    cursor: "pointer",
                    color: "#111827",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* ✅ 예약 패널 */}
            {overlayVisible && reserveStep > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 126,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 430,
                    borderRadius: 24,
                    background: "#f9fafb",
                    boxShadow: "0 10px 28px rgba(15,23,42,0.45)",
                    padding: "14px 16px 16px",
                    fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    fontSize: 13,
                    color: "#111827",
                    transform:
                      reserveStep > 0
                        ? "translateY(0)"
                        : "translateY(120%)",
                    transition: "transform 0.28s ease",
                  }}
                >
                  {reserveStep === 1 && (
                    <>
                      <div
                        style={{
                          marginBottom: 8,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {selected.name} 예약하기
                      </div>
                      <div
                        style={{
                          marginBottom: 12,
                          color: "#4b5563",
                          fontSize: 12,
                        }}
                      >
                        날짜와 시간을 선택해 주세요. (실제 예약이 아닌 베타
                        테스트 화면입니다.)
                      </div>

                      {/* 날짜 선택 */}
                      <div
                        style={{
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            marginBottom: 6,
                            color: "#6b7280",
                          }}
                        >
                          날짜 선택
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          {dateOptions.map((d) => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => setReserveDate(d.value)}
                              style={{
                                flex: 1,
                                borderRadius: 9999,
                                border: "none",
                                padding: "6px 0",
                                fontSize: 12,
                                cursor: "pointer",
                                background:
                                  reserveDate === d.value
                                    ? "#2563eb"
                                    : "#e5e7eb",
                                color:
                                  reserveDate === d.value
                                    ? "#ffffff"
                                    : "#111827",
                              }}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 시간 선택 */}
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            marginBottom: 6,
                            color: "#6b7280",
                          }}
                        >
                          시간 선택
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {timeOptions.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setReserveTime(t)}
                              style={{
                                flexBasis: "30%",
                                borderRadius: 9999,
                                border: "none",
                                padding: "6px 0",
                                fontSize: 12,
                                cursor: "pointer",
                                background:
                                  reserveTime === t ? "#2563eb" : "#e5e7eb",
                                color:
                                  reserveTime === t
                                    ? "#ffffff"
                                    : "#111827",
                                textAlign: "center",
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {reserveStep === 2 && (
                    <>
                      <div
                        style={{
                          marginBottom: 8,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        예약이 완료된 것처럼 보여주는 화면입니다 😊
                      </div>
                      <div
                        style={{
                          marginBottom: 10,
                          color: "#4b5563",
                          fontSize: 12,
                        }}
                      >
                        실제 예약이 잡히지는 않지만{" "}
                        <span style={{ fontWeight: 600 }}>
                          베타 테스트용으로 {reserveDate} {reserveTime}
                        </span>
                        에 예약한 것처럼 동선을 확인할 수 있어요.
                      </div>
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          background: "#e5f2ff",
                          fontSize: 12,
                          color: "#1f2937",
                        }}
                      >
                        • 매장: {selected.name}
                        <br />
                        • 날짜: {reserveDate}
                        <br />
                        • 시간: {reserveTime}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 🔻 상세 정보 패널 (메뉴 / 시술) */}
            {overlayVisible && detailOpen && detail && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 126,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 430,
                    borderRadius: 24,
                    background: "#f9fafb",
                    boxShadow: "0 10px 28px rgba(15,23,42,0.45)",
                    padding: "14px 16px 16px",
                    fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    fontSize: 13,
                    color: "#111827",
                    transform: detailOpen
                      ? "translateY(0)"
                      : "translateY(120%)",
                    transition: "transform 0.28s ease",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 6,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {detail.title}
                  </div>
                  <div
                    style={{
                      marginBottom: 8,
                      color: "#4b5563",
                      fontSize: 12,
                    }}
                  >
                    {detail.tagline}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 10,
                      fontSize: 12,
                      color: "#4b5563",
                    }}
                  >
                    <span>⏰ {detail.hours}</span>
                    <span>⭐ {detail.highlight}</span>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    {detail.menu.map((item) => (
                      <div
                        key={item.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span>{item.name}</span>
                        {item.note && (
                          <span
                            style={{
                              color: "#6b7280",
                              fontSize: 12,
                            }}
                          >
                            {item.note}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
