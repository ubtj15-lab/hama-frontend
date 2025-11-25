// app/search/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import storesData from "../../data/stores";

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

  const categoryStores = stores.filter((s) => s.category === activeCategory);

  const pages: CardInfo[][] = [
    categoryStores.slice(0, 3),
    categoryStores.slice(3, 6),
    categoryStores.slice(6, 9),
  ];

  const [pageIndex, setPageIndex] = useState(0);
  const currentCards = pages[pageIndex] ?? [];
  const [selectedId, setSelectedId] = useState<string>(
    currentCards[0]?.id ?? pages[0]?.[0]?.id
  );

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [reserveStep, setReserveStep] = useState<0 | 1 | 2>(0);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);

  const selected =
    currentCards.find((c) => c.id === selectedId) ?? currentCards[0];
  const others = currentCards.filter((c) => c.id !== selected?.id);
  const detail = selected ? STORE_DETAILS[selected.id] : undefined;

  // 👉 스와이프 제스처용 touch 좌표
  const touchStartX = useRef<number | null>(null);
  const touchLastX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchLastX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchLastX.current = t.clientX;
  };

  const handleTouchEnd = () => {
    if (
      touchStartX.current === null ||
      touchLastX.current === null ||
      touchStartY.current === null
    )
      return;

    const dx = touchLastX.current - touchStartX.current;

    // 좌우 스와이프가 아니거나 너무 짧으면 무시
    if (Math.abs(dx) < 50) {
      touchStartX.current = touchLastX.current = touchStartY.current = null;
      return;
    }

    if (dx < 0) {
      // 왼쪽으로 스와이프 => 다음 페이지
      if (pageIndex < pages.length - 1 && pages[pageIndex + 1].length) {
        goToPage(pageIndex + 1);
      }
    } else {
      // 오른쪽으로 스와이프 => 이전 페이지
      if (pageIndex > 0) {
        goToPage(pageIndex - 1);
      }
    }

    touchStartX.current = touchLastX.current = touchStartY.current = null;
  };

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

  const goToMap = (card: CardInfo) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("hama_search_last_id", card.id);
    }

    router.push(
      `/map?q=${encodeURIComponent(card.name)}&lat=${card.lat}&lng=${card.lng}`
    );
  };

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

  const handleDetailClick = () => {
    resetReserve();
    setDetailOpen((prev) => !prev);
  };

  const detailLabel = getDetailButtonLabel(selected);

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

  const resetReserve = () => {
    setReserveStep(0);
    setReserveDate(null);
    setReserveTime(null);
  };

  const dateOptions = [
    { label: "오늘", value: "오늘" },
    { label: "내일", value: "내일" },
    { label: "모레", value: "모레" },
  ];

  const timeOptions = ["11:00", "13:00", "15:00", "17:00", "19:00"];

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
  }, [query, activeCategory]);

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
      {/* 상단 바 */}
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

      {/* 기본 화면 (스와이프 영역) */}
      {!overlayVisible && selected && (
        <div
          style={{
            touchAction: "pan-y", // 위아래 스크롤은 그대로, 좌우는 우리가 처리
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
              margin: "0 auto",
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
              justifyContent: "center",
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

          {/* 페이지 점 */}
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

      {/* 나머지 (확대 모드, 예약 패널 등)는 네 코드 그대로 ↓ */}
      {/* ---- 여기부터는 네가 올려둔 overlayVisible === true 부분 / STORE_DETAILS 등 그대로 두면 돼 ---- */}
      {/* (길어서 그대로 복붙해두면 됨 – 위쪽만 바꿔주면 스와이프는 동작해) */}

      {/* 🔥 확대 모드 + 나머지 로직은 생략 – 기존 코드 그대로 유지 */}
      {overlayVisible && selected && (
        /* ... 네가 올려둔 overlayVisible 블록 그대로 ... */
        <></>
      )}
    </main>
  );
}

function labelOfCategory(category: Store["category"]): string {
  if (category === "cafe") return "카페";
  if (category === "restaurant") return "식당";
  if (category === "beauty") return "미용실";
  return category;
}

function getDetailButtonLabel(place: CardInfo | null): string {
  if (!place) return "정보";
  if (place.category === "beauty") return "시술";
  if (place.category === "cafe" || place.category === "restaurant") return "메뉴";
  return "정보";
}

type StoreDetail = {
  title: string;
  tagline: string;
  hours: string;
  highlight: string;
  menu: { name: string; note?: string }[];
};

const STORE_DETAILS: Record<string, StoreDetail> = {
  // 기존에 써둔 상세 정보 그대로 두면 됨
};
