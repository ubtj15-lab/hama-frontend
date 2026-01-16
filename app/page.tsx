"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { HomeCard } from "@/lib/storeTypes";
import { fetchHomeCardsByTab } from "@lib/storeRepository";


import FeedbackFab from "@/components/FeedbackFab";
import { logEvent } from "@/lib/logEvent";

// ---- Web Speech API 타입 선언 (빌드 에러 방지) ----
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

// ======================
// 🗂 카테고리 매핑 & 인식
// ======================
const CATEGORY_MAP: Record<string, string> = {
  카페: "CE7",
  커피: "CE7",
  카페테리아: "CE7",

  식당: "FD6",
  음식점: "FD6",
  밥집: "FD6",
  한식: "FD6",
  분식: "FD6",
  레스토랑: "FD6",

  미용실: "BK9",
  헤어샵: "BK9",
  헤어: "BK9",
  이발소: "BK9",

  액티비티: "AT4",
  활동: "AT4",
};

function inferCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (lower.includes(key)) return CATEGORY_MAP[key];
  }
  return null;
}

function buildSearchKeyword(rawText: string, categoryCode: string | null): string {
  let t = rawText.replace(/\s+/g, " ").trim();

  const stopPhrases = [
    "근처",
    "가까운",
    "주변",
    "근방",
    "주위",
    "찾아줘",
    "알려줘",
    "추천해줘",
    "검색해줘",
    "좀",
    "해줘",
  ];

  for (const p of stopPhrases) {
    t = t.split(p).join("");
  }
  t = t.trim();

  if (!t && categoryCode) {
    if (categoryCode === "CE7") return "카페";
    if (categoryCode === "FD6") return "식당";
    if (categoryCode === "BK9") return "미용실";
    if (categoryCode === "AT4") return "액티비티";
  }

  if (!t) return rawText;
  return t;
}

// ======================
// 🧩 포인트 / 로그 저장 구조
// ======================
interface HamaUser {
  nickname: string;
  points: number;
}
interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

const USER_KEY = "hamaUser";
const LOG_KEY = "hamaPointLogs";
const LOGIN_FLAG_KEY = "hamaLoggedIn";

function loadUserFromStorage(): HamaUser {
  if (typeof window === "undefined") return { nickname: "게스트", points: 0 };
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { nickname: "게스트", points: 0 };
    const parsed = JSON.parse(raw);
    return {
      nickname: parsed.nickname ?? "게스트",
      points: typeof parsed.points === "number" ? parsed.points : 0,
    };
  } catch {
    return { nickname: "게스트", points: 0 };
  }
}

function saveUserToStorage(user: HamaUser) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

function appendPointLog(amount: number, reason: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const prev: PointLog[] = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const log: PointLog = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
      amount,
      reason,
      createdAt: now.toISOString(),
    };
    const next = [log, ...prev].slice(0, 100);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  // 🔹 메뉴 관련
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 60, left: 10 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // 🔹 유저 (닉네임 + 포인트)
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });

  // 🔹 로그인 여부
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 🔹 내 위치 (위도/경도)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ✅ 홈 추천 탭 + 로딩
  const [homeTab, setHomeTab] = useState<HomeTabKey>("all");
  const [isHomeLoading, setIsHomeLoading] = useState(false);

  // 🔹 메인 추천 카드 슬라이더 상태
  const [activeIndex, setActiveIndex] = useState(0);
  const [homeCards, setHomeCards] = useState<HomeCard[]>([]);

  // 🔹 추천 카드 디테일 오버레이
  const [selectedCard, setSelectedCard] = useState<HomeCard | null>(null);

  // ======================
  // 🧩 초기 유저 정보 + 로그인 플래그 + 위치 로드
  // ======================
  useEffect(() => {
    const syncLoginState = () => {
      if (typeof window === "undefined") return;

      const loaded = loadUserFromStorage();
      setUser(loaded);

      const flag = window.localStorage.getItem(LOGIN_FLAG_KEY);
      setIsLoggedIn(flag === "1");
    };

    logEvent("session_start", { page: "home" });
    logEvent("page_view", { page: "home" });

    syncLoginState();

    window.addEventListener("pageshow", syncLoginState);
    window.addEventListener("focus", syncLoginState);
    window.addEventListener("storage", syncLoginState);

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
        },
        () => {
          // 위치 거부해도 홈은 돌아가게
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    return () => {
      window.removeEventListener("pageshow", syncLoginState);
      window.removeEventListener("focus", syncLoginState);
      window.removeEventListener("storage", syncLoginState);
    };
  }, []);

  // ======================
  // ✅ 홈 추천 카드: 탭별로 Supabase에서 랜덤 5개만 로드
  // ======================
  useEffect(() => {
    let alive = true;

    async function load() {
      setIsHomeLoading(true);
      try {
        const cards = await fetchHomeCardsByTab(homeTab);
        if (!alive) return;

        const five = (cards ?? []).slice(0, 5);
        setHomeCards(five);
        setActiveIndex(0);

        logEvent("home_tab_loaded", { tab: homeTab, count: five.length });
      } catch (e) {
        if (!alive) return;
        setHomeCards([]);
        setActiveIndex(0);
      } finally {
        if (!alive) return;
        setIsHomeLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [homeTab]);

  // activeIndex가 범위 밖으로 나가면 보정
  useEffect(() => {
    if (activeIndex > Math.max(0, homeCards.length - 1)) setActiveIndex(0);
  }, [homeCards.length, activeIndex]);

  // ======================
  // 💰 포인트 적립 함수
  // ======================
  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  // ======================
  // 🔊 음성 인식 초기 세팅
  // ======================
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      logEvent("voice_unsupported", { browser: navigator.userAgent });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      logEvent("voice_error", { error: event.error });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      setQuery(transcript);
      logEvent("voice_success", { text: transcript });
      handleSearch(transcript);
      addPoints(10, "음성 검색");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔍 검색 실행 (텍스트/음성 공통)
  const handleSearch = (text?: string) => {
    const original = (text ?? query).trim();
    if (!original) return;

    const detectedCategory = inferCategory(original);
    const searchKeyword = buildSearchKeyword(original, detectedCategory);

    const params = new URLSearchParams();
    params.set("query", searchKeyword);
    if (detectedCategory) params.set("category", detectedCategory);

    if (userLocation) {
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    }

    addPoints(5, detectedCategory ? "카테고리 검색" : "검색");
    logEvent("search", {
      query: original,
      usedKeyword: searchKeyword,
      mode: detectedCategory ? "category" : "text",
      category: detectedCategory ?? undefined,
      hasLocation: !!userLocation,
    });

    router.push(`/search?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  };

  const handleMicClick = () => {
    logEvent("mic_click", { page: "home" });

    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
      return;
    }
    if (isListening) recognition.stop();
    else {
      try {
        recognition.start();
      } catch {
        // ignore
      }
    }
  };

  // 🍔 메뉴 버튼 클릭
  const handleMenuClick = () => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) logEvent("page_view", { page: "menu" });
      return next;
    });
  };

  const updateMenuPosition = () => {
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left });
  };

  useEffect(() => {
    if (menuOpen) updateMenuPosition();
  }, [menuOpen]);

  useEffect(() => {
    const handler = () => {
      if (menuOpen) updateMenuPosition();
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [menuOpen]);

  // ============================
  // 🟡 카카오 로그인 / 로그아웃 버튼
  // ============================
  const handleKakaoButtonClick = () => {
    if (isLoggedIn) {
      logEvent("logout", { page: "home" });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(LOG_KEY);
        window.localStorage.removeItem(LOGIN_FLAG_KEY);
      }
      setUser({ nickname: "게스트", points: 0 });
      setIsLoggedIn(false);
      window.location.href = "/api/auth/kakao/logout";
    } else {
      logEvent("login_start", { page: "home" });
      if (typeof window !== "undefined") {
        const newUser: HamaUser = { nickname: "카카오 사용자", points: user.points };
        window.localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
        setUser(newUser);
        setIsLoggedIn(true);
      }
      window.location.href = "/api/auth/kakao/login";
    }
  };

  const goToPointHistory = () => {
    setMenuOpen(false);
    logEvent("page_view", { page: "point_history" });
    router.push("/mypage/points");
  };

  const goToBetaInfo = () => {
    setMenuOpen(false);
    logEvent("page_view", { page: "beta_info" });
    router.push("/beta-info");
  };

  // 🟦 추천 카드 클릭 시: 상세 오버레이 열기
  const handleCardClick = (card: HomeCard) => {
    logEvent("home_recommend_click", {
      id: card.id,
      name: card.name,
      category: card.categoryLabel,
      tab: homeTab,
    });
    setSelectedCard(card);
  };

  // ✅ 탭 UI 데이터
  type HomeTabKey = "all" | "restaurant" | "cafe" | "beauty" | "activity";

const HOME_TABS: { key: HomeTabKey; label: string }[] = [
  { key: "all", label: "종합" },
  { key: "restaurant", label: "식당" },
  { key: "cafe", label: "카페" },
  { key: "beauty", label: "미용실" },
  { key: "activity", label: "액티비티" },
];

const COUNT_BY_TAB: Record<string, number> = {
  all: 12,
  restaurant: 3,
  cafe: 3,
  salon: 3,
  activity: 3,
};


  const cardsToRender = homeCards.slice(0, 5);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f6f0e9 0%, #f4f6fb 40%, #f4f6fb 100%)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          padding: "16px 16px 40px",
          boxSizing: "border-box",
          position: "relative",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        {/* ===================== 메뉴 오버레이 ===================== */}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 1500 }}
            />
            <div
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: 240,
                borderRadius: 20,
                background: "#ffffff",
                boxShadow:
                  "0 10px 25px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.3)",
                padding: 16,
                zIndex: 1600,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  marginBottom: 16,
                  paddingBottom: 10,
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                  안녕하세요
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  {user.nickname || "게스트"} 님
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#EEF2FF",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#4F46E5", fontWeight: 600 }}>포인트</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {user.points.toLocaleString()} P
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleKakaoButtonClick}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "none",
                    background: "#FEE500",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2D2D2D",
                    cursor: "pointer",
                  }}
                >
                  {isLoggedIn ? "로그아웃" : "카카오로 로그인"}
                </button>

                <button
                  onClick={goToPointHistory}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#ffffff",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  포인트 히스토리
                </button>

                <button
                  onClick={goToBetaInfo}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#EEF2FF",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  베타 안내 보기
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===================== 상단 헤더 ===================== */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleMenuClick}
            aria-label="메뉴 열기"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "none",
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 2,
                borderRadius: 999,
                background: "#111827",
                boxShadow: "0 6px 0 #111827, 0 -6px 0 #111827",
              }}
            />
          </button>

          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontWeight: 800,
              letterSpacing: 3,
              fontSize: 20,
              color: "#2563EB",
            }}
          >
            HAMA
          </div>

          <div style={{ width: 40, height: 40 }} />
        </header>

        {/* ===================== 검색바 ===================== */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            background: "#ffffff",
            borderRadius: 999,
            padding: "0 10px 0 18px",
            boxShadow: "0 14px 30px rgba(15,23,42,0.16), 0 0 0 1px rgba(148,163,184,0.12)",
            marginBottom: 18,
          }}
        >
          <span style={{ fontSize: 18, marginRight: 8 }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="근처 카페 찾아줘 / 점심 뭐 먹지"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              height: 46,
              fontSize: 15,
              background: "transparent",
            }}
          />
          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: 999,
              padding: "0 18px",
              height: 34,
              marginLeft: 4,
              background: "linear-gradient(135deg, #2563eb, #4f46e5)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(37,99,235,0.45)",
            }}
          >
            검색
          </button>
        </form>

        {/* ===================== ✅ 추천 탭 5개 ===================== */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
          {HOME_TABS.map((t) => {
            const active = homeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setHomeTab(t.key);
                  logEvent("home_tab_click", { tab: t.key });
                }}
                style={{
                  flex: "0 0 auto",
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid #E5E7EB",
                  background: active ? "#EEF2FF" : "#ffffff",
                  color: active ? "#2563EB" : "#111827",
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {isHomeLoading && (
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 10 }}>
            추천 카드 불러오는 중…
          </div>
        )}

        {/* ===================== 메인 추천 카드 슬라이더 ===================== */}
        <section style={{ marginTop: 10, marginBottom: 34 }}>
          <div style={{ position: "relative", height: 340 }}>
            {cardsToRender.length === 0 && !isHomeLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#6B7280",
                }}
              >
                추천할 매장이 없어요 (데이터/카테고리 코드 확인)
              </div>
            )}

            {cardsToRender.map((card, idx) => {
              const offset = idx - activeIndex;
              const absOffset = Math.abs(offset);
              if (absOffset > 2) return null;

              const depth = Math.min(absOffset, 2);
              const scale = depth === 0 ? 1 : depth === 1 ? 0.93 : 0.86;
              const translateX = offset * 18;

              const boxShadow =
                depth === 0
                  ? "0 22px 45px rgba(15,23,42,0.30)"
                  : depth === 1
                  ? "0 16px 34px rgba(15,23,42,0.20)"
                  : "0 10px 24px rgba(15,23,42,0.14)";

              const distanceKm =
                typeof card.distanceKm === "number" && !Number.isNaN(card.distanceKm)
                  ? card.distanceKm
                  : null;

              const distanceLabel = distanceKm !== null ? `${distanceKm.toFixed(1)} km` : "";

              const moodText = (card.mood && card.mood.trim()) || card.moodText;
              const tags = card.tags ? card.tags.slice(0, 3) : [];

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card)}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    margin: "0 auto",
                    maxWidth: 360,
                    height: 340,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    borderRadius: 32,
                    overflow: "hidden",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    textAlign: "left",
                    boxShadow,
                    transform: `translateX(${translateX}px) scale(${scale})`,
                    transition: "transform 0.35s ease, opacity 0.3s ease, box-shadow 0.3s ease",
                    zIndex: 99 - absOffset,
                    opacity: 1,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                    }}
                  >
                    {card.imageUrl && (
                      <Image src={card.imageUrl} alt={card.name} fill style={{ objectFit: "cover" }} />
                    )}
                  </div>

                  <div style={{ padding: "18px 20px 20px", background: "#ffffff" }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#111827" }}>
                      {card.name}
                    </h2>

                    <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>
                      {card.categoryLabel}
                      {distanceLabel ? ` · ${distanceLabel}` : ""}
                    </div>

                    <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8 }}>{moodText}</div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                      {card.withKids && (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#FEF3C7",
                            fontSize: 11,
                            color: "#92400E",
                          }}
                        >
                          아이랑 가기 좋아요
                        </span>
                      )}

                      {card.forWork && (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#DBEAFE",
                            fontSize: 11,
                            color: "#1D4ED8",
                          }}
                        >
                          작업·공부하기 좋음
                        </span>
                      )}

                      {typeof card.priceLevel === "number" && card.priceLevel > 0 && (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#ECFDF5",
                            fontSize: 11,
                            color: "#047857",
                          }}
                        >
                          {"₩".repeat(card.priceLevel)}
                        </span>
                      )}

                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#F3F4F6",
                            fontSize: 11,
                            color: "#374151",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 인디케이터 점 (5개 기준) */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 6 }}>
            {cardsToRender.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                style={{
                  width: idx === activeIndex ? 16 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  background: idx === activeIndex ? "#2563EB" : "rgba(148,163,184,0.6)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>
        </section>

        {/* ===================== 추천 카드 디테일 오버레이 ===================== */}
        {selectedCard && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2000,
              background: "rgba(15,23,42,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div onClick={() => setSelectedCard(null)} style={{ position: "absolute", inset: 0 }} />

            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 430,
                height: "100%",
                maxHeight: 820,
                padding: "16px 12px 96px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: 32,
                  overflow: "hidden",
                  background: "#111827",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  {selectedCard.imageUrl && (
                    <Image src={selectedCard.imageUrl} alt={selectedCard.name} fill style={{ objectFit: "cover" }} />
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      border: "none",
                      background: "rgba(15,23,42,0.65)",
                      color: "#f9fafb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    ←
                  </button>

                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: "20px 20px 20px",
                      background: "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 100%)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.75)",
                        color: "#f9fafb",
                        fontSize: 11,
                        marginBottom: 10,
                      }}
                    >
                      {selectedCard.name} · {selectedCard.categoryLabel}
                    </div>

                    <div style={{ fontSize: 14, color: "#e5e7eb" }}>
                      {selectedCard.mood ?? selectedCard.moodText}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "0 20px",
                  boxSizing: "border-box",
                }}
              >
                {["예약", "길안내", "평점", "메뉴"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      logEvent("place_detail_action", { id: selectedCard.id, name: selectedCard.name, action: label });

                      if (label === "길안내") alert("길안내 기능은 다음 버전에서 지도로 연결할게요!");
                      else if (label === "예약") alert("예약 기능은 사장님 플랫폼 붙이면서 열릴 예정이에요");
                      else if (label === "평점") alert("평점/후기 기능은 하마 커뮤와 함께 붙을 예정이에요");
                      else alert("메뉴 정보는 추후 실제 매장 데이터 연동 시 노출됩니다.");
                    }}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 999,
                      border: "none",
                      background: "#f9fafb",
                      color: "#111827",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== 마이크 버튼 ===================== */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <button
            type="button"
            onClick={handleMicClick}
            aria-label="음성 검색 시작"
            style={{
              width: 92,
              height: 92,
              borderRadius: "50%",
              border: "6px solid rgba(255,255,255,0.6)",
              background: isListening
                ? "linear-gradient(135deg, #1d4ed8, #1e40af)"
                : "linear-gradient(135deg, #38bdf8, #2563eb)",
              boxShadow: "0 18px 40px rgba(37, 99, 235, 0.45), 0 0 0 4px rgba(191, 219, 254, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease",
              transform: isListening ? "scale(1.06)" : "scale(1)",
            }}
          >
            <span style={{ fontSize: 32, color: "#ffffff" }}>🎙</span>
          </button>

          <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
            “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
          </p>
        </section>

        {/* ===================== 하단 탭바 ===================== */}
        <nav
          style={{
            position: "fixed",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 430,
            padding: "6px 26px 8px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 999,
              boxShadow: "0 10px 25px rgba(15,23,42,0.2), 0 0 0 1px rgba(148,163,184,0.18)",
              display: "flex",
              justifyContent: "space-around",
              padding: "8px 12px",
              fontSize: 12,
            }}
          >
            <button
              type="button"
              style={{
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                color: "#2563EB",
                fontWeight: 700,
                cursor: "default",
              }}
            >
              <span>🏠</span>
              <span>홈</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logEvent("page_view", { page: "mypage" });
                alert("마이페이지는 베타에서 준비 중이에요!");
              }}
              style={{
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                color: "#9CA3AF",
                cursor: "pointer",
              }}
            >
              <span>👤</span>
              <span>마이페이지</span>
            </button>
          </div>
        </nav>

        <FeedbackFab />
      </div>
    </main>
  );
}
