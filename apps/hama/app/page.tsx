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
import HomeTopBar from "./_components/HomeTopBar";
import { HomeHero } from "./_components/home/HomeHero";
import { QuickScenarioGrid } from "./_components/home/QuickScenarioGrid";
import { HomeBottomNav } from "./_components/home/HomeBottomNav";
import { useRecent } from "./_hooks/useRecent";
import { HamaEvents } from "@/lib/analytics/events";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { recordRecentIntent } from "@/lib/recentIntents";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { colors, space } from "@/lib/designTokens";
import { isOnboardingCompleted, parseUserProfile } from "@/lib/onboardingProfile";

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
const ONBOARDING_PROMPT_DISMISSED_KEY = "hama_onboarding_prompt_dismissed";

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
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [todayAskCount, setTodayAskCount] = useState<number | null>(null);
  const { recentCards, recordView } = useRecent();

  const openId = searchParams.get("open");

  useEffect(() => {
    const sync = () => {
      setUser(loadUserFromStorage());
      try {
        setIsLoggedIn(window.localStorage.getItem(LOGIN_FLAG_KEY) === "1");
      } catch {
        setIsLoggedIn(false);
      }
    };
    logEvent("session_start", { page: "home" });
    logEvent("page_view", { page: "home" });
    logEvent(HamaEvents.home_enter, { page: "home", surface: "first_paint" });
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
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const n = Number(json?.today?.card_views ?? 0);
        if (alive && Number.isFinite(n)) setTodayAskCount(n);
      } catch {}
    })();
    return () => {
      alive = false;
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
      HamaEvents.home_scenario_submit,
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

  const handleLoginClick = () => {
    logEvent("login_start", { page: "home", source: "home_header" });
    window.location.href = "/api/auth/kakao/login?return_to=%2F";
  };

  const handleLogoutClick = () => {
    logEvent("logout", { page: "home", source: "home_header" });
    try {
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(LOG_KEY);
      window.localStorage.removeItem(LOGIN_FLAG_KEY);
    } catch {}
    window.location.href = "/api/auth/kakao/logout";
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))",
        overflowX: "visible",
        background: `linear-gradient(180deg, ${colors.bgDefault} 0%, ${colors.bgMuted} 100%)`,
      }}
    >
      <style>{`
        @keyframes hamaFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hamaFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div
        style={{
          maxWidth: 430,
          margin: "0 auto",
          padding: `12px ${space.pageX}px 0`,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          overflowX: "visible",
        }}
      >
        <div style={{ animation: "hamaFadeUp 360ms ease both", position: "relative", zIndex: 40 }}>
          <HomeTopBar
            isLoggedIn={isLoggedIn}
            nickname={user.nickname}
            onLoginClick={handleLoginClick}
            onLogoutClick={handleLogoutClick}
            onGoMy={() => router.push("/my")}
            onAlertClick={() => {
              logEvent("home_alert_click", { page: "home" });
            }}
          />
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 120ms both", position: "relative", zIndex: 10 }}>
          <HomeHero
            onSubmitQuery={(q) => {
              logEvent(HamaEvents.home_scenario_submit, { query: q, page: "home", source: "hero_natural_input" });
              goResults(q, "hero_natural_input");
            }}
          />
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 240ms both", position: "relative", zIndex: 10 }}>
          <QuickScenarioGrid
            onPick={(q) => {
              logEvent(HamaEvents.home_quick_scenario, { query: q, page: "home" });
              goResults(q, "quick_grid");
            }}
          />
        </div>
        {todayAskCount != null && todayAskCount >= 10 && (
          <p
            style={{
              margin: "2px 0 0",
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            오늘 {todayAskCount.toLocaleString()}명이 하마한테 물어봤어
          </p>
        )}
      </div>
      <HomeBottomNav active="home" />
    </main>
  );
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function HomeEntryGate() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [showLegacyPrompt, setShowLegacyPrompt] = useState(false);
  const [showPromptBadge, setShowPromptBadge] = useState(false);

  useEffect(() => {
    const loggedIn = localStorage.getItem(LOGIN_FLAG_KEY) === "1";
    setIsLoggedIn(loggedIn);
    if (!loggedIn) {
      setIsCheckingProfile(false);
      return;
    }

    const isNewUser = getCookie("hama_is_new_user") === "1";
    void (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!res.ok) {
          // 쿠키 동기화 타이밍 이슈로 프로필 조회가 실패해도
          // 로그인 직후 사용자가 설문을 놓치지 않도록 안전 분기한다.
          if (isNewUser) {
            router.replace("/onboarding?return_to=%2F");
            return;
          }
          const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "1";
          setShowLegacyPrompt(!dismissed);
          setShowPromptBadge(dismissed);
          setIsCheckingProfile(false);
          return;
        }
        const json = await res.json();
        const profile = parseUserProfile(json?.user_profile);
        const completed = isOnboardingCompleted(profile);
        if (!completed && isNewUser) {
          router.replace("/onboarding?return_to=%2F");
          return;
        }
        if (!completed && !isNewUser) {
          const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "1";
          setShowLegacyPrompt(!dismissed);
          setShowPromptBadge(dismissed);
        }
      } catch (e) {
        console.error("[home] profile check failed", e);
        if (isNewUser) {
          router.replace("/onboarding?return_to=%2F");
          return;
        }
        const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "1";
        setShowLegacyPrompt(!dismissed);
        setShowPromptBadge(dismissed);
      } finally {
        setIsCheckingProfile(false);
      }
    })();
  }, [router]);

  if (isLoggedIn == null || isCheckingProfile) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: colors.bgDefault }}>
        로딩 중...
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: colors.bgDefault, padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 8px 20px rgba(15,23,42,0.08)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>HAMA 시작하기</h1>
          <p style={{ margin: "0 0 16px", color: "#475569", lineHeight: 1.45 }}>
            카카오 로그인 후 바로 맞춤 추천을 받아보세요.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/auth/kakao/login?return_to=%2F";
            }}
            style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 14px", background: "#FEE500", fontWeight: 800, cursor: "pointer" }}
          >
            카카오로 로그인
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {showLegacyPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.55)",
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, padding: 16 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>더 정확한 추천을 위해 30초만 알려주세요</h2>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>지금 알려주면 첫 추천부터 바로 반영돼요.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 12px", background: "#2563eb", color: "#fff", fontWeight: 700 }}
                onClick={() => router.push("/onboarding?return_to=%2F")}
              >
                지금 알려주기
              </button>
              <button
                type="button"
                style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", background: "#fff", fontWeight: 700 }}
                onClick={() => {
                  localStorage.setItem(ONBOARDING_PROMPT_DISMISSED_KEY, "1");
                  setShowLegacyPrompt(false);
                  setShowPromptBadge(true);
                }}
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
      {showPromptBadge && (
        <button
          type="button"
          onClick={() => router.push("/onboarding?return_to=%2F")}
          style={{
            position: "fixed",
            right: 16,
            bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
            zIndex: 1000,
            border: "none",
            borderRadius: 999,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            padding: "8px 12px",
            boxShadow: "0 8px 14px rgba(37,99,235,0.35)",
          }}
        >
          설문 미완료
        </button>
      )}
      <HomePageContent />
    </>
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
      <HomeEntryGate />
    </Suspense>
  );
}
