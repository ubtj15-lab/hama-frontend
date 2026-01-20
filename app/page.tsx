"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { HomeTabKey, HomeCard } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";

import FeedbackFab from "@/components/FeedbackFab";

import HomeTopBar from "./_components/HomeTopBar";
import HomeSearchBar from "./_components/HomeSearchBar";
import HomeSwipeDeck from "./_components/HomeSwipeDeck";
import CardDetailOverlay from "./_components/CardDetailOverlay";
import MicButton from "./components/MicButton";

import { useHomeCards } from "./_hooks/useHomeCards";

// ---- Web Speech API 타입 선언 (빌드 에러 방지) ----
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

// ======================
// 🧩 포인트 / 로그 저장
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
  } catch {}
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
  } catch {}
}

export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState("");

  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [homeTab, setHomeTab] = useState<HomeTabKey>("all");
  const { cards: homeCards, isLoading: isHomeLoading } = useHomeCards(homeTab);

  const [selectedCard, setSelectedCard] = useState<HomeCard | null>(null);

  // ---- 음성 인식 ----
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  // 로그인 상태 동기화
  useEffect(() => {
    const sync = () => {
      const loaded = loadUserFromStorage();
      setUser(loaded);

      const flag = window.localStorage.getItem(LOGIN_FLAG_KEY);
      setIsLoggedIn(flag === "1");
    };

    logEvent("session_start", { page: "home" });
    logEvent("page_view", { page: "home" });

    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Web Speech API setup (기존 홈 UX 유지: 마이크 버튼 + 음성 결과 반영)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript ?? "").trim();
      if (!transcript) return;
      setQuery(transcript);
      addPoints(10, "음성 검색");
      logEvent("voice_success", { text: transcript });
      router.push(`/search?query=${encodeURIComponent(transcript)}`);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    addPoints(5, "검색");
    logEvent("search", { query: q });
    router.push(`/search?query=${encodeURIComponent(q)}`);
  };

  const handleKakaoButtonClick = () => {
    if (isLoggedIn) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(LOG_KEY);
        window.localStorage.removeItem(LOGIN_FLAG_KEY);
      }
      setUser({ nickname: "게스트", points: 0 });
      setIsLoggedIn(false);
      window.location.href = "/api/auth/kakao/logout";
    } else {
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

  // ✅ 디테일 액션 (예약/길안내/평점/메뉴)
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

  const handlePlaceDetailAction = (
    card: HomeCard,
    action: "예약" | "길안내" | "평점" | "메뉴"
  ) => {
    const name = ((card as any)?.name ?? "").trim();
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
      openInNewTab(
        `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 예약`)}`
      );
      return;
    }

    if (action === "평점") {
      openInNewTab(
        `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 리뷰`)}`
      );
      return;
    }

    openInNewTab(
      `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${name} 메뉴`)}`
    );
  };

  // ---- 마이크 버튼 동작 ----
  const handleMicClick = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
      return;
    }
    if (isListening) {
      try {
        recognition.stop();
      } catch {}
    } else {
      try {
        recognition.start();
      } catch {}
    }
  };

  const tabButtons: { key: HomeTabKey; label: string }[] = [
    { key: "all", label: "종합" },
    { key: "restaurant", label: "식당" },
    { key: "cafe", label: "카페" },
    { key: "salon", label: "미용실" },
    { key: "activity", label: "액티비티" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 110,
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "20px 18px 0" }}>
        <HomeTopBar
          isLoggedIn={isLoggedIn}
          nickname={user.nickname}
          points={user.points}
          onLoginClick={handleKakaoButtonClick}
          onGoPoints={() => router.push("/mypage/points")}
          onGoBeta={() => router.push("/beta-info")}
        />

        <HomeSearchBar query={query} onChange={setQuery} onSubmit={handleSearchSubmit} />

        {/* ✅ 카테고리 탭 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 22 }}>
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
                  boxShadow: active ? "0 8px 22px rgba(37,99,235,0.18)" : "0 6px 16px rgba(15,23,42,0.08)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ✅ 메인 추천 카드 (스와이프/클릭 가능) */}
        <HomeSwipeDeck
          cards={homeCards}
          homeTab={homeTab}
          isLoading={isHomeLoading}
          onOpenCard={(c) => setSelectedCard(c)}
          onAddPoints={addPoints}
        />

        {/* ✅ 마이크 버튼 + 안내 문구 */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            marginBottom: 34,
          }}
        >
          <MicButton
            isListening={isListening}
            onClick={handleMicClick}
            size={92}
          />

          <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
            “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
          </p>
        </section>

        {/* ✅ 디테일 오버레이 (하단 버튼 포함) */}
        {selectedCard && (
          <CardDetailOverlay
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
            onAction={(card, action) => handlePlaceDetailAction(card, action)}
          />
        )}

        {!selectedCard && <FeedbackFab />}

        {/* ✅ 하단 탭바 (홈/마이페이지) */}
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
            zIndex: 1000,
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
      </div>
    </main>
  );
}
