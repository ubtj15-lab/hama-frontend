"use client";

import React, {
  useMemo,
  useRef,
  useState,
  CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ===== 타입 정의 =====
type Place = {
  id: number;
  name: string;
  category: string;
  image: string;
  description: string;
  actions: string[]; // ["예약", "길안내", "평점", "메뉴"] 이런 식
};

// ===== 데모용 매장 데이터 =====
const PLACES: Place[] = [
  {
    id: 1,
    name: "블루문 카페",
    category: "카페 · 브런치",
    image: "/images/bluemoon-cafe.png",
    description:
      "로컬 윈도로 내린 브루잉 커피와 브런치를 즐길 수 있는 분위기 좋은 카페.",
    // 카페: 예약 · 길안내 · 평점 · 메뉴
    actions: ["예약", "길안내", "평점", "메뉴"],
  },
  {
    id: 2,
    name: "솔향 미용실",
    category: "헤어 · 미용실",
    image: "/images/solhyang-hair.png",
    description:
      "잔잔한 음악과 함께 편안하게 헤어 관리를 받을 수 있는 동네 단골 미용실.",
    // 미용실: 예약 · 길안내 · 평점 · 시술
    actions: ["예약", "길안내", "평점", "시술"],
  },
  {
    id: 3,
    name: "도란도란 식당",
    category: "한식 · 가족 모임",
    image: "/images/dorandoran-food.png",
    description:
      "가족, 친척, 친구들과 도란도란 이야기 나누기 좋은 한식 전문 식당.",
    // 식당: 예약 · 길안내 · 평점 · 식당
    actions: ["예약", "길안내", "평점", "식당"],
  },
  {
    id: 4,
    name: "초코베이커리",
    category: "디저트 · 베이커리",
    image: "/images/choco-bakery.png",
    description:
      "갓 구운 빵과 디저트가 가득한 동네 빵집. 아이들과 함께 오기 좋은 곳.",
    actions: ["예약", "길안내", "평점", "메뉴"],
  },
  {
    id: 5,
    name: "그린파크 놀이터",
    category: "공원 · 산책",
    image: "/images/greenpark-play.png",
    description:
      "아이들과 산책하고 뛰어놀기 좋은 넓은 잔디와 놀이 시설이 있는 공원.",
    actions: ["길안내", "평점", "산책코스", "즐겨찾기"],
  },
];

const CARD_RADIUS = 22;
const CARD_SHADOW = "0 10px 22px rgba(15, 23, 42, 0.16)";

const baseCardStyle: CSSProperties = {
  width: "100%",
  background: "#ffffff",
  borderRadius: CARD_RADIUS,
  boxShadow: CARD_SHADOW,
  padding: 16,
  boxSizing: "border-box",
};

export default function RecommendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ===== URL 기반 초기 상태 복원 =====
  const paramSelectedId = searchParams.get("selectedId");
  const initialSelectedId = paramSelectedId
    ? Number(paramSelectedId)
    : PLACES[0].id;

  const initialExpanded = searchParams.get("mode") === "expanded";

  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedId
  );

  const [overlayVisible, setOverlayVisible] =
    useState<boolean>(initialExpanded);
  const [expanded, setExpanded] = useState<boolean>(initialExpanded);

  // 즐겨찾기 / 예약 / 평점 상태
  const [favorites, setFavorites] = useState<number[]>([]);
  const [reserveTarget, setReserveTarget] = useState<Place | null>(null);
  const [reserveStep, setReserveStep] = useState<0 | 1 | 2>(0);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Place | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);

  const detailRef = useRef<HTMLDivElement | null>(null);

  const selectedPlace: Place | null = useMemo(() => {
    if (selectedId == null) return null;
    return PLACES.find((p) => p.id === selectedId) ?? null;
  }, [selectedId]);

  const isFavorite = (placeId: number) => favorites.includes(placeId);

  // ===== 예약/평점/디테일 관련 헬퍼 =====
  const resetReserve = () => {
    setReserveStep(0);
    setReserveDate(null);
    setReserveTime(null);
    setReserveTarget(null);
  };

  const resetRating = () => {
    setRatingTarget(null);
    setRatingValue(null);
  };

  // ===== 카드 열기/닫기 (여기가 핵심) =====
  const openExpanded = (id: number) => {
    setSelectedId(id);
    setOverlayVisible(true);
    setExpanded(false);
    resetReserve();
    resetRating();

    // URL에 현재 상태 기록 → /recommend?selectedId=1&mode=expanded
    router.replace(`/recommend?selectedId=${id}&mode=expanded`, {
      scroll: false,
    });

    // 살짝 딜레이 후 scale 애니메이션
    setTimeout(() => setExpanded(true), 10);
  };

  const closeExpanded = () => {
    setExpanded(false);
    resetReserve();
    resetRating();

    // 애니메이션 끝난 뒤 오버레이 닫고 URL도 원상복구
    setTimeout(() => {
      setOverlayVisible(false);
      router.replace("/recommend", { scroll: false });
    }, 280);
  };

  // 오버레이 영역 스크롤로 닫기 (패널 안 열려 있을 때만)
  const handleOverlayScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (
      reserveStep === 0 &&
      !ratingTarget &&
      e.currentTarget.scrollTop > 40
    ) {
      closeExpanded();
    }
  };

  // 버튼 공통 핸들러
  const handleActionClick = (place: Place, action: string) => {
    // 1) 예약
    if (action.includes("예약")) {
      setReserveTarget(place);
      setReserveStep(1);
      setReserveDate(null);
      setReserveTime(null);
      return;
    }

    // 2) 길안내 (지금은 외부 카카오맵으로 – 나중에 /map으로 바꿀 수 있음)
    if (action === "길안내") {
      const url = `https://map.kakao.com/?q=${encodeURIComponent(
        place.name
      )}`;
      window.open(url, "_blank");
      return;
    }

    // 3) 평점
    if (action === "평점") {
      setRatingTarget(place);
      setRatingValue(null);
      return;
    }

    // 4) 메뉴/시술/식당/산책코스 → 아래 상세 설명 카드로 스크롤
    if (
      action.includes("메뉴") ||
      action === "시술" ||
      action === "식당" ||
      action === "산책코스"
    ) {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      return;
    }

    // 5) 즐겨찾기
    if (action === "즐겨찾기") {
      setFavorites((prev) => {
        const exists = prev.includes(place.id);
        const next = exists
          ? prev.filter((id) => id !== place.id)
          : [...prev, place.id];

        alert(
          exists
            ? `"${place.name}"을(를) 즐겨찾기에서 해제했어요.`
            : `"${place.name}"을(를) 즐겨찾기에 추가했어요!`
        );
        return next;
      });
    }
  };

  // 예약/평점용 옵션
  const dateOptions = [
    { label: "오늘", value: "오늘" },
    { label: "내일", value: "내일" },
    { label: "모레", value: "모레" },
  ];
  const timeOptions = ["11:00", "13:00", "15:00", "17:00", "19:00"];

  const placesWithoutSelected = PLACES.filter(
    (p) => p.id !== selectedPlace?.id
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          padding: "16px 16px 32px",
          boxSizing: "border-box",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* 상단 안내 카드 */}
        <section
          style={{
            ...baseCardStyle,
            marginBottom: 18,
            background: "#00b894",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            하마 추천 스팟
          </div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            지금 인기 많은 로컬 매장을 만나보세요!
          </div>
        </section>

        {/* 리스트: 선택된 카드 + 나머지 카드들 */}
        <section>
          {selectedPlace && (
            <div
              onClick={() => openExpanded(selectedPlace.id)}
              style={{
                ...baseCardStyle,
                padding: 0,
                marginBottom: 16,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 240,
                  overflow: "hidden",
                }}
              >
                {/* 큰 이미지 */}
                <img
                  src={selectedPlace.image}
                  alt={selectedPlace.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {/* 그라데이션 */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 110,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))",
                  }}
                />
                {/* 라벨 */}
                <div
                  style={{
                    position: "absolute",
                    left: 18,
                    bottom: 18,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {selectedPlace.name} · {selectedPlace.category}
                  {isFavorite(selectedPlace.id) && " ★"}
                </div>
              </div>
            </div>
          )}

          {/* 나머지 작은 카드들 */}
          {placesWithoutSelected.map((place) => (
            <div
              key={place.id}
              onClick={() => openExpanded(place.id)}
              style={{
                ...baseCardStyle,
                padding: 12,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <img
                  src={place.image}
                  alt={place.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  {place.name}
                  {isFavorite(place.id) && " ★"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  {place.category}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 하단 상세 설명 카드 */}
        {selectedPlace && (
          <section
            ref={detailRef}
            style={{
              ...baseCardStyle,
              marginTop: 18,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {selectedPlace.name} · 상세 설명
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              {selectedPlace.description}
            </div>
          </section>
        )}

        {/* ===== 전체 화면 오버레이 (큰 카드 모드) ===== */}
        {overlayVisible && selectedPlace && (
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
                <img
                  src={selectedPlace.image}
                  alt={selectedPlace.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />

                {/* 뒤로가기 */}
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

                {/* 라벨 */}
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
                    fontFamily:
                      "Noto Sans KR, system-ui, sans-serif",
                  }}
                >
                  {selectedPlace.name} · {selectedPlace.category}
                  {isFavorite(selectedPlace.id) && " ★"}
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
                  transform: expanded
                    ? "translateY(0)"
                    : "translateY(24px)",
                  transition:
                    "opacity 0.3s ease 0.03s, transform 0.3s ease 0.03s",
                }}
              >
                {selectedPlace.actions.map((label) => (
                  <button
                    key={label}
                    onClick={() =>
                      handleActionClick(selectedPlace, label)
                    }
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: 9999,
                      padding: "9px 0",
                      background: "#f3f4f6",
                      fontSize: 13,
                      fontFamily:
                        "Noto Sans KR, system-ui, sans-serif",
                      cursor: "pointer",
                      color: "#111827",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ===== 예약 패널 ===== */}
              {reserveTarget && reserveStep > 0 && (
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
                      boxShadow:
                        "0 10px 28px rgba(15,23,42,0.45)",
                      padding: "14px 16px 16px",
                      fontFamily:
                        "Noto Sans KR, system-ui, sans-serif",
                      fontSize: 13,
                      color: "#111827",
                      transform:
                        reserveStep > 0
                          ? "translateY(0)"
                          : "translateY(120%)",
                      transition: "transform 0.28s ease",
                    }}
                  >
                    {/* 1단계: 날짜/시간 선택 */}
                    {reserveStep === 1 && (
                      <>
                        <div
                          style={{
                            marginBottom: 8,
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {reserveTarget.name} 예약하기
                        </div>
                        <div
                          style={{
                            marginBottom: 12,
                            color: "#4b5563",
                            fontSize: 12,
                          }}
                        >
                          날짜와 시간을 선택해 주세요. (실제 예약이
                          아닌 베타 테스트 화면입니다.)
                        </div>

                        {/* 날짜 선택 */}
                        <div style={{ marginBottom: 10 }}>
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
                                onClick={() =>
                                  setReserveDate(d.value)
                                }
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
                                onClick={() =>
                                  setReserveTime(t)
                                }
                                style={{
                                  flexBasis: "30%",
                                  borderRadius: 9999,
                                  border: "none",
                                  padding: "6px 0",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  background:
                                    reserveTime === t
                                      ? "#2563eb"
                                      : "#e5e7eb",
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

                        <button
                          type="button"
                          onClick={() => {
                            if (!reserveDate || !reserveTime) {
                              alert(
                                "날짜와 시간을 먼저 선택해 주세요 🙂"
                              );
                              return;
                            }
                            setReserveStep(2);
                          }}
                          style={{
                            width: "100%",
                            marginTop: 10,
                            borderRadius: 9999,
                            border: "none",
                            padding: "8px 0",
                            fontSize: 13,
                            fontWeight: 600,
                            background:
                              reserveDate && reserveTime
                                ? "#2563eb"
                                : "#9ca3af",
                            color: "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          예약 확정하기
                        </button>
                      </>
                    )}

                    {/* 2단계: 완료 화면 */}
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
                          <span
                            style={{ fontWeight: 600 }}
                          >
                            베타 테스트용으로 {reserveDate}{" "}
                            {reserveTime}
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
                            marginBottom: 10,
                          }}
                        >
                          • 매장: {reserveTarget.name}
                          <br />
                          • 날짜: {reserveDate}
                          <br />
                          • 시간: {reserveTime}
                        </div>

                        <button
                          type="button"
                          onClick={resetReserve}
                          style={{
                            width: "100%",
                            borderRadius: 9999,
                            border: "none",
                            padding: "8px 0",
                            fontSize: 13,
                            fontWeight: 600,
                            background: "#2563eb",
                            color: "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          다른 시간으로 다시 예약해보기
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ===== 평점 패널 ===== */}
              {ratingTarget && (
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
                      background: "#ffffff",
                      boxShadow:
                        "0 10px 28px rgba(15,23,42,0.45)",
                      padding: "16px 18px 18px",
                      fontSize: 13,
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {ratingTarget.name} 평점 남기기
                      </div>
                      <button
                        type="button"
                        onClick={resetRating}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontSize: 18,
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <div
                      style={{
                        marginBottom: 10,
                        color: "#4b5563",
                        fontSize: 12,
                      }}
                    >
                      오늘 방문하셨다면 별점을 한 번 눌러 주세요 🙂
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setRatingValue(star)
                          }
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 18,
                            background:
                              ratingValue &&
                              ratingValue >= star
                                ? "#facc15"
                                : "#e5e7eb",
                          }}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!ratingValue) {
                          alert("별점을 선택해 주세요 🙂");
                          return;
                        }
                        alert(
                          `"${ratingTarget.name}"에 ${ratingValue}점 남겨주신 걸로 처리할게요! (데모)`
                        );
                        resetRating();
                      }}
                      style={{
                        width: "100%",
                        borderRadius: 9999,
                        border: "none",
                        padding: "8px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        background: ratingValue
                          ? "#2563eb"
                          : "#9ca3af",
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      평점 제출하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
