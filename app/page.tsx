"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { HomeTabKey, HomeCard } from "@/lib/storeTypes";
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

  for (const p of stopPhrases) t = t.split(p).join("");
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

  // ✅ 메인 추천 카드 스택 상태
  const [activeIndex, setActiveIndex] = useState(0);
  const [homeCards, setHomeCards] = useState<HomeCard[]>([]);

  // ✅ 디테일 오버레이
  const [selectedCard, setSelectedCard] = useState<HomeCard | null>(null);

  // ======================
  // 🧩 초기 유저/로그인/위치
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
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
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
  // ✅ 홈 추천 카드 로드 (탭별 5개)
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
      } catch {
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

  // activeIndex 보정
  useEffect(() => {
    const max = Math.max(0, homeCards.length - 1);
    if (activeIndex > max) setActiveIndex(0);
  }, [homeCards.length, activeIndex]);

  // ======================
  // 💰 포인트
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
  // 🔊 음성 인식
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

  // 🔍 검색
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
      } catch {}
    }
  };

  // =====================
  // 🧭 디테일 액션 (예약/길안내/평점/메뉴)
  // =====================
  const openInNewTab = (url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  };

  const getCardLatLng = (card: HomeCard): { lat?: number; lng?: number } => {
    const anyCard = card as any;
    const lat =
      typeof anyCard.lat === "number"
        ? anyCard.lat
        : typeof anyCard.latitude === "number"
        ? anyCard.latitude
        : undefined;
    const lng =
      typeof anyCard.lng === "number"
        ? anyCard.lng
        : typeof anyCard.longitude === "number"
        ? anyCard.longitude
        : undefined;
    return { lat, lng };
  };

  const handlePlaceDetailAction = (card: HomeCard, action: "예약" | "길안내" | "평점" | "메뉴") => {
    const name = (card?.name ?? "").trim();
    if (!name) return;

    logEvent("place_detail_action", { id: (card as any).id, name, action });

    if (action === "길안내") {
      const { lat, lng } = getCardLatLng(card);
      if (typeof lat === "number" && typeof lng === "number") {
        openInNewTab(`https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`);
      } else {
        openInNewTab(`https://map.kakao.com/?q=${encodeURIComponent(name)}`);
      }
      return;
    }

    if (action === "예약") {
      openInNewTab(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 예약`)}`);
      return;
    }

    if (action === "평점") {
      openInNewTab(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 리뷰`)}`);
      return;
    }

    openInNewTab(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 메뉴`)}`);
  };

  // 🍔 메뉴 버튼
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
  // 🟡 카카오 로그인 / 로그아웃
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

  const menuItems = [
    { label: "포인트 내역", onClick: goToPointHistory },
    { label: "베타 안내", onClick: goToBetaInfo },
  ];

  // ============================
  // 🧭 홈 추천 탭
  // ============================
  const tabButtons: { key: HomeTabKey; label: string }[] = [
    { key: "all", label: "종합" },
    { key: "restaurant", label: "식당" },
    { key: "cafe", label: "카페" },
    { key: "beauty", label: "미용실" },
    { key: "activity", label: "액티비티" },
  ];

  // ✅ 최대 5장만
  const cardsToRender = homeCards.slice(0, 5);
  const total = cardsToRender.length;

  // ✅ 스택: 원형으로 4장
  const STACK_SIZE = Math.min(4, total);
  const stackCards =
    total > 0
      ? Array.from({ length: STACK_SIZE }, (_, i) => cardsToRender[(activeIndex + i) % total])
      : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        paddingBottom: 110,
      }}
    >
      <div
  style={{
    maxWidth: 430,
    margin: "0 auto",
    padding: "20px 18px 0", // ⬅ 위/좌우 여백 증가
  }}
>

        {/* ===================== 상단 바 ===================== */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleMenuClick}
            aria-label="메뉴 열기"
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              border: "none",
              background: "#ffffff",
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ☰
          </button>

          <div style={{ fontWeight: 900, letterSpacing: 1.2, fontSize: 22, color: "#2563EB" }}>
            HAMA
          </div>

          <button
            type="button"
            onClick={handleKakaoButtonClick}
            style={{
              height: 42,
              borderRadius: 999,
              border: "none",
              padding: "0 14px",
              background: isLoggedIn ? "#111827" : "#FEE500",
              color: isLoggedIn ? "#ffffff" : "#111827",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
            }}
          >
            {isLoggedIn ? "로그아웃" : "카카오 로그인"}
          </button>
        </header>

        {/* ===================== 메뉴 오버레이 ===================== */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 3000,
              background: "transparent",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                width: 180,
                borderRadius: 16,
                background: "#ffffff",
                boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 12, color: "#6B7280" }}>닉네임</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{user.nickname}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#2563EB", fontWeight: 800 }}>
                  {user.points.toLocaleString()}P
                </div>
              </div>

              {menuItems.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={it.onClick}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===================== 검색 바 ===================== */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#ffffff",
            borderRadius: 999,
            padding: "10px 12px",
            boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>🔎</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="근처 카페 찾아줘 / 점심 뭐 먹지"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              background: "transparent",
            }}
          />
          <button
            type="submit"
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg, #38bdf8, #2563eb)",
              color: "#ffffff",
              fontWeight: 800,
            }}
          >
            검색
          </button>
        </form>

        {/* ===================== 카테고리 탭 ===================== */}
        <div
  style={{
    display: "flex",
    gap: 10,
    rowGap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 22,
  }}
>


          {tabButtons.map((t) => {
            const active = t.key === homeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setHomeTab(t.key);
                  addPoints(1, "홈 탭 변경");
                }}
                style={{
                  border: "none",
                  cursor: "pointer",
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 999,
                  background: active ? "#dbeafe" : "#ffffff",
                  color: active ? "#1d4ed8" : "#111827",
                  fontWeight: active ? 900 : 700,
                  boxShadow: active
                    ? "0 8px 22px rgba(37,99,235,0.18)"
                    : "0 6px 16px rgba(15,23,42,0.08)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== 메인 추천 카드 (겹침 스택) ===================== */}
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", overflow: "visible" }}>
            <div
  style={{
    width: "100%",
    maxWidth: 320,
    aspectRatio: "1 / 1",
    position: "relative",
    overflow: "visible",
    margin: "0 auto", // ✅ 가운데 정렬
  }}
>

              {/* 로딩 */}
              {isHomeLoading && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 28,
                    background: "#ffffff",
                    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6B7280",
                    fontWeight: 800,
                  }}
                >
                  불러오는 중...
                </div>
              )}

              {/* 비어있음 */}
              {!isHomeLoading && total === 0 && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 28,
                    background: "#ffffff",
                    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6B7280",
                    fontWeight: 800,
                  }}
                >
                  추천 카드가 없어요
                </div>
              )}

              {/* ✅ 실제 카드 스택: 뒤→앞 렌더로 안정적인 겹침 */}
              {!isHomeLoading &&
                total > 0 &&
                stackCards
                  .map((card, depth) => ({ card, depth }))
                  .reverse()
                  .map(({ card, depth }) => {
                    // frontDepth: 0이 맨 앞
                    const frontDepth = STACK_SIZE - 1 - depth;

                    const translateX = frontDepth * 14; // ✅ 14, 28, 42
                    const translateY = frontDepth * 8;  // ✅ 8, 16, 24

                    const scale =
                      frontDepth === 0 ? 1 : frontDepth === 1 ? 0.95 : frontDepth === 2 ? 0.90 : 0.85;

                    const opacity =
                      frontDepth === 0 ? 1 : frontDepth === 1 ? 0.82 : frontDepth === 2 ? 0.62 : 0.46;

                    const shadow =
                      frontDepth === 0
                        ? "0 22px 45px rgba(15,23,42,0.30)"
                        : frontDepth === 1
                        ? "0 16px 34px rgba(15,23,42,0.20)"
                        : "0 10px 24px rgba(15,23,42,0.14)";

                    const anyCard = card as any;
                    const imageUrl: string | undefined = anyCard.imageUrl ?? anyCard.image ?? undefined;

                    return (
                      <button
                        key={String(anyCard.id ?? `${frontDepth}`)}
                        type="button"
                        onClick={() => {
                          if (frontDepth !== 0) {
                            setActiveIndex((prev) => (total ? (prev + 1) % total : 0));
                            return;
                          }
                          setSelectedCard(card);
                          logEvent("home_card_open", { id: anyCard.id, name: anyCard.name, tab: homeTab });
                          addPoints(2, "홈 추천 카드 열람");
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          borderRadius: 28,
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          background: "#ffffff",
                          overflow: "hidden",
                          boxShadow: shadow,
                          opacity,
                          zIndex: 100 - frontDepth,
                          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                          transition: "transform 0.25s ease, opacity 0.25s ease",
                        }}
                      >
                        <div style={{ position: "relative", width: "100%", height: "70%", background: "#dbeafe" }}>
                          {imageUrl && (
                            <Image src={imageUrl} alt={anyCard.name ?? "place"} fill style={{ objectFit: "cover" }} />
                          )}
                        </div>

                        <div style={{ padding: 16, textAlign: "left" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
                            {anyCard.name}
                          </div>

                          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                            {anyCard.categoryLabel ?? anyCard.category}
                          </div>

                          <div style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>
                            {anyCard.mood ?? anyCard.moodText ?? ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* 인디케이터 */}
          <div
  style={{
    marginTop: 18,
    marginBottom: 28, // ⬅ 마이크랑 거리
    display: "flex",
    justifyContent: "center",
    gap: 6,
  }}
>

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
                  {(() => {
                    const anyCard = selectedCard as any;
                    const imageUrl: string | undefined = anyCard.imageUrl ?? anyCard.image ?? undefined;
                    if (!imageUrl) return null;
                    return <Image src={imageUrl} alt={anyCard.name ?? "place"} fill style={{ objectFit: "cover" }} />;
                  })()}

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
                      {(selectedCard as any).name} · {(selectedCard as any).categoryLabel ?? (selectedCard as any).category}
                    </div>

                    <div style={{ fontSize: 14, color: "#e5e7eb" }}>
                      {(selectedCard as any).mood ?? (selectedCard as any).moodText ?? ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 액션 버튼 */}
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
                {(["예약", "길안내", "평점", "메뉴"] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaceDetailAction(selectedCard, label);
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
