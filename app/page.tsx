"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { HomeTabKey, HomeCard } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";

import FeedbackFab from "@/components/FeedbackFab";

import HomeTopBar from "./_components/HomeTopBar";
import HomeSearchBar from "./_components/HomeSearchBar";
import HomeSwipeDeck from "./_components/HomeSwipeDeck";
import { useHomeCards } from "./_hooks/useHomeCards";

import MicButton from "@/app/components/MicButton";

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

  // 로그인 상태 동기화
  useEffect(() => {
    const sync = () => {
      const loaded = loadUserFromStorage();
      setUser(loaded);

      const flag = window.localStorage.getItem(LOGIN_FLAG_KEY);
      setIsLoggedIn(flag === "1");
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  const handleSearch = (raw?: string) => {
    const q = (raw ?? query).trim();
    if (!q) return;

    logEvent("search", { query: q });
    addPoints(5, "검색");
    router.push(`/search?query=${encodeURIComponent(q)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  };

  const handleVoiceResult = (text: string) => {
    const t = (text ?? "").trim();
    if (!t) return;

    setQuery(t);
    logEvent("voice_search", { query: t });
    addPoints(10, "음성 검색");
    router.push(`/search?query=${encodeURIComponent(t)}`);
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

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 140, // ✅ 하단탭 + 여유
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "20px 18px 0" }}>
        {/* 상단바 */}
        <HomeTopBar
          isLoggedIn={isLoggedIn}
          nickname={user.nickname}
          points={user.points}
          onLoginClick={handleKakaoButtonClick}
          onGoPoints={() => router.push("/mypage/points")}
          onGoBeta={() => router.push("/beta-info")}
        />

        {/* 검색바 */}
        <HomeSearchBar query={query} onChange={setQuery} onSubmit={handleSearchSubmit} />

        {/* 카테고리 탭 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 22 }}>
          {[
            { key: "all", label: "종합" },
            { key: "restaurant", label: "식당" },
            { key: "cafe", label: "카페" },
            { key: "salon", label: "미용실" },
            { key: "activity", label: "액티비티" },
          ].map((t) => {
            const active = (t.key as HomeTabKey) === homeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setHomeTab(t.key as HomeTabKey);
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

        {/* 카드 덱 */}
        <HomeSwipeDeck
          cards={homeCards}
          homeTab={homeTab}
          isLoading={isHomeLoading}
          onOpenCard={(c) => {
            setSelectedCard(c);
            addPoints(2, "홈 추천 카드 열람");
          }}
          onAddPoints={addPoints}
        />

        {/* 마이크 섹션 */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            marginTop: 10,
            marginBottom: 40,
          }}
        >
          <MicButton onResult={handleVoiceResult} size={92} />

          <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
            “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
          </p>
        </section>

        {/* 디테일 오버레이 (현재는 최소 유지) */}
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
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedCard && <FeedbackFab />}
      </div>

      {/* 하단 탭바 */}
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
          zIndex: 1500,
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
              router.push("/mypage/points");
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
    </main>
  );
}
