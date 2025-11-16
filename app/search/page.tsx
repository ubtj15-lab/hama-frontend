"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { PLACES, Place } from "../data/places";

type CardInfo = Place;

export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("query") || "";

  // 베타용: 검색 결과 카드 3개만 사용
  const cards: CardInfo[] = [PLACES[0], PLACES[1], PLACES[2]];

  const [selectedId, setSelectedId] = useState<string>(cards[0].id);

  // overlayVisible: 오버레이 DOM 존재 여부
  // expanded: 오버레이 안 요소들이 펼쳐진 상태
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 상세 정보 패널 열림 여부
  const [detailOpen, setDetailOpen] = useState(false);

  const selected =
    cards.find((c) => c.id === selectedId) ?? cards[0];
  const others = cards.filter((c) => c.id !== selected.id);

  const detail = PLACE_DETAILS[selected.id];

  const goToMap = (card: CardInfo) => {
    router.push(
      `/map?q=${encodeURIComponent(card.name)}&lat=${card.lat}&lng=${card.lng}`
    );
  };

  const handleReserve = () => {
    alert("예약 기능은 베타 버전에서 준비 중이에요 🙂");
  };

  const handleRate = () => {
    alert("평점 기능은 추후 버전에서 제공될 예정입니다!");
  };

  // 🔹 상세 패널 열고 닫기
  const handleDetail = () => {
    setDetailOpen((prev) => !prev);
  };

  const detailLabel = getDetailButtonLabel(selected);

  // 🔹 카드 클릭 → 확대 모드 애니메이션 시작
  const openExpanded = (id: string) => {
    setSelectedId(id);
    setDetailOpen(false); // 새 카드 열 때는 상세 닫기
    setExpanded(false);
    setOverlayVisible(true);
    // 살짝 딜레이 주고 expanded 켜서 transition 발동
    setTimeout(() => {
      setExpanded(true);
    }, 10);
  };

  // 🔹 닫기 → 접히는 애니메이션 후 오버레이 제거
  const closeExpanded = () => {
    setExpanded(false);
    setDetailOpen(false);
    setTimeout(() => {
      setOverlayVisible(false);
    }, 280);
  };

  const handleOverlayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // 상세가 열려 있을 땐 스크롤로 닫히지 않게
    if (!detailOpen && e.currentTarget.scrollTop > 40) {
      closeExpanded();
    }
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
      {/* 상단 바 */}
      <div
  style={{
    width: "100%",
    maxWidth: 430,
    marginTop: detailOpen ? 40 : 0,  // ⬅ 여백 크게 조정
maxHeight: detailOpen ? 260 : 0,
opacity: detailOpen ? 1 : 0,
transform: detailOpen ? "translateY(0)" : "translateY(20px)",
transition:
  "opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease, margin-top 0.3s ease",
overflow: "hidden",

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

        <div style={{ width: 32 }} />
      </div>

      {/* 기본 화면 (검색 카드) – 오버레이가 떠 있을 땐 숨김 */}
      {!overlayVisible && (
        <>
          {/* 위: 큰 카드 */}
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
              {selected.name} · {selected.category}
            </div>
          </div>

          {/* 아래: 작은 카드 2개 */}
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
        </>
      )}

      {/* 🔥 확대 모드 + 애니메이션 */}
      {overlayVisible && (
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
          {/* 흐릿한 아래 카드 두 장 – 중앙 아래 레이어 */}
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
            {/* 메인 큰 카드 – 슬라이드 + 줌 + 페이드 */}
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
                transition:
                  "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              <Image
                src={selected.image}
                alt={selected.name}
                fill
                sizes="430px"
                style={{ objectFit: "cover" }}
              />

              {/* 안쪽 뒤로가기 버튼 */}
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

              {/* 매장 이름/카테고리 라벨 */}
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
                {selected.name} · {selected.category}
              </div>
            </div>

            {/* 버튼 4개 – 아래에서 위로 슬라이드 인 */}
            <div
              style={{
                width: "100%",
                maxWidth: 430,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 14,
                opacity: expanded ? 1 : 0,
                transform: expanded
                  ? "translateY(0)"
                  : "translateY(24px)",
                transition:
                  "opacity 0.3s ease 0.03s, transform 0.3s ease 0.03s",
              }}
            >
              {[
                { label: "예약", onClick: handleReserve },
                { label: "길안내", onClick: () => goToMap(selected) },
                { label: "평점", onClick: handleRate },
                { label: detailLabel, onClick: handleDetail },
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

            {/* 🔻 상세 정보 패널 (메뉴 / 시술 / 코스 / 정보) */}
            {detail && (
              <div
                style={{
                  width: "100%",
                  maxWidth: 430,
                  marginTop: detailOpen ? 16 : 0,
                  maxHeight: detailOpen ? 260 : 0,
                  opacity: detailOpen ? 1 : 0,
                  transform: detailOpen
                    ? "translateY(0)"
                    : "translateY(20px)",
                  transition:
                    "opacity 0.3s ease, transform 0.3s ease, maxHeight 0.3s ease, marginTop 0.3s ease",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    borderRadius: 24,
                    background: "#f9fafb",
                    boxShadow: "0 10px 28px rgba(15,23,42,0.28)",
                    padding: "14px 16px 16px",
                    fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    fontSize: 13,
                    color: "#111827",
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

/**
 * 매장 종류에 따라 마지막 버튼 라벨 결정
 */
function getDetailButtonLabel(place: CardInfo): string {
  const cat = place.category;
  if (
    cat.includes("카페") ||
    cat.includes("식당") ||
    cat.includes("레스토랑") ||
    cat.includes("디저트") ||
    cat.includes("한식")              // ⭐ 이 줄 추가!
  ) {
    return "메뉴";
  }
  if (cat.includes("미용") || cat.includes("헤어")) {
    return "시술";
  }
  if (cat.includes("공원") || cat.includes("놀이터")) {
    return "코스";
  }
  return "정보";
}


/** 🔽 매장별 상세 정보 (데모용) */

type PlaceDetail = {
  title: string;
  tagline: string;
  hours: string;
  highlight: string;
  menu: { name: string; note?: string }[];
};

const PLACE_DETAILS: Record<string, PlaceDetail> = {
  // 1: 블루문 카페
  "1": {
    title: "블루문 카페 · 시그니처 메뉴",
    tagline: "로컬 원두로 내린 브루잉 커피와 브런치를 즐길 수 있는 분위기 좋은 카페예요.",
    hours: "매일 09:00 ~ 21:00",
    highlight: "에스프레소 바 + 브런치 세트 인기",
    menu: [
      { name: "블루문 라떼", note: "시그니처" },
      { name: "크루아상 플레이트", note: "브런치" },
      { name: "콜드브루", note: "테이크아웃 인기" },
    ],
  },
  // 2: 솔향 미용실
  "2": {
    title: "솔향 미용실 · 시술 메뉴",
    tagline: "잔잔한 음악과 함께 편안하게 헤어 관리를 받을 수 있는 동네 단골 미용실.",
    hours: "화~일 10:00 ~ 20:00 (월 휴무)",
    highlight: "컷 + 펌 세트 만족도 높음",
    menu: [
      { name: "디자인 커트", note: "남·여 공통" },
      { name: "셋팅 펌", note: "손질 쉬운 스타일" },
      { name: "두피 케어", note: "예약제" },
    ],
  },
  // 3: 도란도란 식당
  "3": {
    title: "도란도란 식당 · 오늘의 추천 메뉴",
    tagline: "가족·지인과 편하게 한 끼 식사하기 좋은 한식 메뉴 전문 식당입니다.",
    hours: "매일 11:00 ~ 22:00 (브레이크 15:00 ~ 17:00)",
    highlight: "주말 저녁 가족 단위 방문 많음",
    menu: [
      { name: "도란도란 정식", note: "2인 이상 주문" },
      { name: "수제 제육볶음", note: "매운맛 조절 가능" },
      { name: "된장찌개 · 김치찌개", note: "점심 인기" },
    ],
  },
};
