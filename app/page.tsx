// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";
import FeedbackFab from "@/components/FeedbackFab";

import HomeTopBar from "./_components/HomeTopBar";
import HomeSearchBar from "./_components/HomeSearchBar";
import HomeSwipeDeck from "./_components/HomeSwipeDeck";

import { useHomeCards } from "./_hooks/useHomeCards";
import { useHomeMode } from "./_hooks/useHomeMode";
import { useNearbyCards } from "./_hooks/useNearbyCards";
import { useUIOverlay } from "./_providers/UIOverlayProvider";
import { openDirections } from "@/lib/openDirections";
import { openNaverPlace } from "@/lib/openNaverPlace";

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

const PER_CATEGORY = 5;

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

// ======================
// ✅ 검색 문장 → "근처 추천" 의도 감지
// ======================
function normalizeQuery(q: string) {
  return q
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNearbyIntent(q: string) {
  const t = normalizeQuery(q);
  // “근처/주변/가까운/내 주변/여기 근처/근방/근처에” 류
  return /(근처|주변|가까운|가까이|내\s?주변|여기\s?근처|근방)/.test(t);
}

function inferTabFromQuery(q: string): HomeTabKey {
  const t = normalizeQuery(q);

  // 카페
  if (/(카페|커피|디저트|베이커리|브런치|라떼)/.test(t)) return "cafe";

  // 식당
  if (
    /(식당|맛집|밥|점심|저녁|아침|혼밥|국밥|한식|일식|중식|양식|파스타|피자|초밥|라멘|고기|삼겹|갈비|회|분식)/.test(
      t
    )
  )
    return "restaurant";

  // 미용실
  if (/(미용실|헤어|커트|펌|염색|네일|왁싱|피부|뷰티|샵)/.test(t)) return "salon";

  // 액티비티
  if (/(액티비티|데이트|갈만한|놀거리|체험|전시|공원|박물관|운동|볼링|방탈출|카페거리)/.test(t))
    return "activity";

  return "all";
}

type Mode = "recommend" | "explore";

export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState("");

  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [homeTab, setHomeTab] = useState<HomeTabKey>("all");

  // ✅ 홈 진입/탭 변경 시 랜덤 갱신 키
  const [shuffleKey, setShuffleKey] = useState<number>(0);

  // ✅ “근처 추천” 의도일 때 강제로 explore 모드로 오버라이드
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);

  const { mode: baseMode, loc, isLocLoading } = useHomeMode();
  const mode: Mode = modeOverride ?? baseMode;

  const { cards: recommendCards, isLoading: isRecommendLoading } = useHomeCards(homeTab, shuffleKey);
  const { cards: nearbyCards, isLoading: isNearbyLoading } = useNearbyCards(homeTab, loc, shuffleKey);

  const [selectedCard, setSelectedCard] = useState<HomeCard | null>(null);

  const { setOverlayOpen } = useUIOverlay();
  useEffect(() => {
    setOverlayOpen(!!selectedCard);
  }, [selectedCard, setOverlayOpen]);

  useEffect(() => {
    setShuffleKey(Date.now());
  }, []);

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
    window.addEventListener("pageshow", sync);

    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", sync);
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

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // ✅ “근처 추천”이면 홈에서 바로 처리 (explore + 탭 자동 선택)
    if (isNearbyIntent(q)) {
      const tab = inferTabFromQuery(q);

      setModeOverride("explore");
      setHomeTab(tab);
      setShuffleKey(Date.now());

      addPoints(5, "근처 추천 요청");
      logEvent("nearby_intent", { query: q, tab });

      // 검색창은 비우는게 UX 깔끔
      setQuery("");
      return;
    }

    // ✅ 일반 검색은 기존대로 search 페이지로
    addPoints(5, "검색");
    logEvent("search", { query: q, page: "home" });
    router.push(`/search?query=${encodeURIComponent(q)}`);
  };

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
      return;
    }

    logEvent("login_start", { page: "home" });
    if (typeof window !== "undefined") {
      const newUser: HamaUser = { nickname: "카카오 사용자", points: user.points };
      window.localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
      setUser(newUser);
      setIsLoggedIn(true);
    }
    window.location.href = "/api/auth/kakao/login";
  };

  // ✅ 원본 덱 카드
  const deckCardsRaw =
    mode === "explore" ? (nearbyCards.length > 0 ? nearbyCards : recommendCards) : recommendCards;

  const deckLoading =
    mode === "explore"
      ? (isLocLoading || isNearbyLoading) && recommendCards.length === 0
      : isRecommendLoading;

  const visibleDeckCards = useMemo(() => {
    if (homeTab === "all") return deckCardsRaw;
    return deckCardsRaw.slice(0, PER_CATEGORY);
  }, [deckCardsRaw, homeTab]);

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

  const getImageUrl = (card: HomeCard | null) => {
    if (!card) return undefined;
    const anyCard = card as any;
    return (anyCard.imageUrl ??
      anyCard.image ??
      anyCard.image_url ??
      anyCard.imageURL ??
      undefined) as string | undefined;
  };

  const handlePlaceDetailAction = (card: HomeCard, action: "길안내" | "예약·자세히") => {
    const anyCard = card as any;
    const name = String(anyCard?.name ?? "").trim();
    if (!name) return;

    logEvent("place_detail_action", {
      id: anyCard.id,
      name,
      action,
      mode,
      tab: homeTab,
    });

    if (action === "길안내") {
      const { lat, lng } = getCardLatLng(card);
      openDirections({ name, lat: lat ?? null, lng: lng ?? null });
      return;
    }

    openNaverPlace({
      name,
      naverPlaceId: anyCard?.naver_place_id ?? null,
    });
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

        <div
          style={{
            display: "flex",
            gap: 10,
            rowGap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 18,
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
                  setShuffleKey(Date.now());
                  // 탭을 직접 누르면 “기본모드로 복귀”는 하지 않음 (원하면 여기서 setModeOverride(null) 넣으면 됨)
                  addPoints(1, "홈 탭 변경");
                  logEvent("home_tab_click", { tab: t.key, mode });
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

        <HomeSwipeDeck
          key={`${mode}-${homeTab}-${shuffleKey}`}
          cards={visibleDeckCards}
          homeTab={homeTab}
          mode={mode}
          isLoading={deckLoading}
          onOpenCard={(c) => {
            setSelectedCard(c);
            addPoints(2, "홈 추천 카드 열람");
            logEvent("home_card_open", {
              id: c.id,
              name: c.name,
              tab: homeTab,
              mode,
            });
          }}
          onAddPoints={addPoints}
        />

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
                    const imageUrl = getImageUrl(selectedCard);
                    if (!imageUrl) return null;
                    return (
                      <Image
                        src={imageUrl}
                        alt={selectedCard.name ?? "place"}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      width: 36,
                      height: 36,
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
                      background:
                        "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 100%)",
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
                      {(selectedCard as any).name} ·{" "}
                      {(selectedCard as any).categoryLabel ?? (selectedCard as any).category}
                    </div>

                    <div style={{ fontSize: 14, color: "#e5e7eb" }}>
                      {(selectedCard as any).mood?.[0] ?? (selectedCard as any).moodText ?? ""}
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
                {(["길안내", "예약·자세히"] as const).map((label) => (
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
                      fontWeight: 800,
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

        {!selectedCard && <FeedbackFab />}
      </div>
    </main>
  );
}
