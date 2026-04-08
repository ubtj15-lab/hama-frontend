/**
 * 홈 — 입력 유도 + 빠른 시작만 (결정형 첫 화면).
 *
 * 홈에서 숨긴 것(기능 삭제 아님, 복구 가능):
 * - RecentIntentChips → 컴포넌트 유지, `/` 에서만 마운트 안 함. 필요 시 아래처럼 다시 추가.
 * - 최근 본 가로 스크롤 → 마이(`/my`)의「최근 본 카드」+ `?open=` 딥링크 로 유지.
 * - 빠른 추가 3종(카페/미용/놀거리) → `QuickScenarioGrid` 의 `QUICK_SCENARIO_CANDIDATES` 후반에 보관.
 * - HomeTrustPickSection: 신뢰 보조 카드 최대 3개(/api/home-recommend + 시나리오 시드). 최근 검색/최근 본 아님.
 * 결과 화면 NextSuggestions 등에서 탐색·후속 추천은 그대로.
 */
"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { logEvent } from "@/lib/logEvent";
import FeedbackFab from "@/components/FeedbackFab";
import HomeTopBar from "./_components/HomeTopBar";
import { HomeHero } from "./_components/home/HomeHero";
import { SearchInput } from "./_components/home/SearchInput";
import { QuickScenarioGrid } from "./_components/home/QuickScenarioGrid";
import { HomeTrustPickSection } from "./_components/home/HomeTrustPickSection";
import { useRecent } from "./_hooks/useRecent";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { recordRecentIntent } from "@/lib/recentIntents";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { colors, space } from "@/lib/designTokens";

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

function normalizeQuery(q: string) {
  return q
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNearbyIntent(q: string) {
  const t = normalizeQuery(q);
  return /(근처|주변|가까운|가까이|내\s?주변|여기\s?근처|근방)/.test(t);
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { recentCards, recordView } = useRecent();

  const openId = searchParams.get("open");

  useEffect(() => {
    const sync = () => {
      setUser(loadUserFromStorage());
      setIsLoggedIn(window.localStorage.getItem(LOGIN_FLAG_KEY) === "1");
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

  useEffect(() => {
    if (!openId) return;
    const c = recentCards.find((x) => x.id === openId);
    if (c) {
      stashPlaceForSession(c);
      recordView(c.id);
      router.replace(`/place/${encodeURIComponent(c.id)}`, { scroll: false });
    }
  }, [openId, recentCards, router, recordView]);

  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  const goResults = (q: string, source: string) => {
    const t = q.trim();
    if (!t) return;
    recordRecentIntent(t);
    const parsed = parseScenarioIntent(t);
    logEvent(
      "search_submit",
      mergeLogPayload(analyticsFromScenario(parsed), { query: t, source, page: "home" })
    );
    if (isNearbyIntent(t)) {
      addPoints(5, "근처 추천 요청");
      logEvent("nearby_intent", { query: t });
    } else {
      addPoints(3, "상황 검색");
    }
    router.push(`/results?q=${encodeURIComponent(t)}`);
  };

  /* 복구 예시: <RecentIntentChips onPick={(q) => goResults(q, "recent_chip")} /> */

  const handleKakaoButtonClick = () => {
    if (isLoggedIn) {
      logEvent("logout", { page: "home" });
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(LOG_KEY);
      window.localStorage.removeItem(LOGIN_FLAG_KEY);
      setUser({ nickname: "게스트", points: 0 });
      setIsLoggedIn(false);
      window.location.href = "/api/auth/kakao/logout";
      return;
    }
    logEvent("login_start", { page: "home" });
    window.location.href = "/api/auth/kakao/login";
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 48,
        background: `linear-gradient(180deg, ${colors.bgDefault} 0%, #EEF2FF 100%)`,
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto", padding: `12px ${space.pageX}px 0` }}>
        <HomeTopBar
          isLoggedIn={isLoggedIn}
          nickname={user.nickname}
          points={user.points}
          onLoginClick={handleKakaoButtonClick}
          onGoPoints={() => router.push("/mypage/points")}
          onGoMy={() => router.push("/my")}
          onGoBeta={() => router.push("/beta-info")}
        />
        <HomeHero />
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={(e) => {
            e.preventDefault();
            goResults(query, "search_input");
          }}
          onMicClick={() => {
            logEvent("voice_mic_click", { page: "home" });
          }}
        />
        <QuickScenarioGrid onPick={(q) => goResults(q, "quick_grid")} />

        <HomeTrustPickSection
          onPlaceOpen={(card) => {
            stashPlaceForSession(card);
            recordView(card.id);
            router.push(`/place/${encodeURIComponent(card.id)}`);
          }}
          onScenarioGo={(q) => goResults(q, "home_trust_pick")}
        />

        <FeedbackFab />
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.bgDefault,
          }}
        >
          로딩 중...
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
