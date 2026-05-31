/**
 * 홈 — 입력 유도 + 빠른 시작만 (결정형 첫 화면).
 *
 * 홈에서 숨긴 것(기능 삭제 아님, 복구 가능):
 * - RecentIntentChips → 컴포넌트 유지, `/` 에서만 마운트 안 함. 필요 시 아래처럼 다시 추가.
 * - 최근 본 가로 스크롤 → 마이(`/my`)의「최근 본 카드」+ `?open=` 딥링크 로 유지.
 * - 홈 퀵 카테고리 → `QuickScenarioGrid` 의 `QUICK_CATEGORY_CANDIDATES` + `public/home` 일러스트.
 * - HomeTrustPickSection: 홈 자동 추천 카드 — `/` 에서 마운트 안 함 (검색·/search 결과에서만 노출).
 * 결과 화면 NextSuggestions 등에서 탐색·후속 추천은 그대로.
 */
"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { logEvent } from "@/lib/logEvent";
import HomeTopBar from "./_components/HomeTopBar";
import { HomeHero } from "./_components/home/HomeHero";
import { QuickScenarioGrid } from "./_components/home/QuickScenarioGrid";
import { HomeBottomNav } from "./_components/home/HomeBottomNav";
import { useRecent } from "./_hooks/useRecent";
import { useGeoLocation } from "./_hooks/useGeoLocation";
import { HamaEvents } from "@/lib/analytics/events";
import type { HomeResultsNavParams } from "@/lib/homeResultsNavParams";
import { logHamaTabClickTrace, resolveHomeResultsUrl } from "@/lib/hamaTabClickTrace";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { recordRecentIntent } from "@/lib/recentIntents";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { colors, pageBackground, space, radius } from "@/lib/designTokens";
import {
  loadActiveMission,
  RECEIPT_VERIFY_PATH,
  type HamaActiveMission,
} from "@/lib/mission/hamaActiveMission";
import { parseUserProfile } from "@/lib/onboardingProfile";
import { useHamaMe, type HamaMeUser } from "@/lib/auth/useHamaMe";
import { kakaoLoginUrl } from "@/lib/auth/kakaoLogin";
import {
  clearNewUserCookie,
  getCookie,
  isKakaoInAppBrowser,
  isSurveyCompletedResolved,
  logSurveyGate,
  logSurveyRedirect,
  markOnboardingCompletedLocally,
  NEW_USER_COOKIE,
  ONBOARDING_PROMPT_DISMISSED_KEY,
  readLocalOnboardingCompletedAt,
} from "@/lib/surveyGate";

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
const EXPERIMENT_INTRO_SEEN_KEY = "hama_experiment_intro_seen";
const DEFAULT_MISSION_SEARCH_QUERY = "아이랑 갈만한 곳";

const SCENARIO_QUICK_CHIPS: { scenario: string; query: string }[] = [
  { scenario: "아이랑", query: "아이랑 갈만한 곳" },
  { scenario: "데이트", query: "데이트하기 좋은 곳" },
  { scenario: "가족 외식", query: "가족 외식하기 좋은 식당" },
  { scenario: "혼자 카페", query: "혼자 가기 좋은 카페" },
  { scenario: "조용한 곳", query: "조용한 곳" },
  { scenario: "주차 편한 곳", query: "주차 편한 곳" },
];

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

type HomePageContentProps = {
  isLoggedIn: boolean;
  meUser: HamaMeUser | null;
};

function HomePageContent({ isLoggedIn, meUser }: HomePageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userLocation = useGeoLocation();
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [todayAskCount, setTodayAskCount] = useState<number | null>(null);
  const [activeMission, setActiveMission] = useState<HamaActiveMission | null>(null);
  const { recentCards, recordView } = useRecent();

  const openId = searchParams.get("open");

  useEffect(() => {
    if (meUser) {
      setUser({ nickname: meUser.nickname, points: meUser.points });
    } else {
      setUser(loadUserFromStorage());
    }
  }, [meUser]);

  useEffect(() => {
    logEvent("session_start", { page: "home" });
    logEvent("page_view", { page: "home" });
    logEvent(HamaEvents.home_enter, { page: "home", surface: "first_paint" });
  }, []);

  useEffect(() => {
    const syncMission = () => setActiveMission(loadActiveMission());
    syncMission();
    window.addEventListener("pageshow", syncMission);
    window.addEventListener("focus", syncMission);
    return () => {
      window.removeEventListener("pageshow", syncMission);
      window.removeEventListener("focus", syncMission);
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

  const goSearch = (query: string, source: string, scenario?: string) => {
    const q = query.trim();
    if (!q) return;
    if (scenario) {
      logEvent("scenario_quick_click", { scenario, query: q, page: "home", source });
    }
    recordRecentIntent(q);
    addPoints(3, "상황 검색");
    const params = new URLSearchParams({ query: q });
    if (userLocation) {
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleMissionBannerStart = () => {
    logEvent("mission_banner_click", { query: DEFAULT_MISSION_SEARCH_QUERY, page: "home" });
    goSearch(DEFAULT_MISSION_SEARCH_QUERY, "mission_banner");
  };

  const goResults = (q: string, source: string, nav?: HomeResultsNavParams) => {
    const t = q.trim();
    if (!t) return;
    recordRecentIntent(t);
    const parsed = parseScenarioIntent(t);
    logEvent(
      HamaEvents.home_scenario_submit,
      mergeLogPayload(analyticsFromScenario(parsed), {
        query: t,
        source,
        page: "home",
        explicit_intent: nav?.intent ?? null,
        explicit_category: nav?.category ?? null,
        explicit_mode: nav?.mode ?? null,
      })
    );
    if (isNearbyIntent(t)) {
      addPoints(5, "근처 추천 요청");
      logEvent("nearby_intent", { query: t });
    } else {
      addPoints(3, "상황 검색");
    }
    const nextUrl = resolveHomeResultsUrl(t, nav);
    console.log("[HAMA_HOME_NAV_TO_RESULTS]", { source, nextUrl });
    logHamaTabClickTrace({
      source: `HomePage:${source}`,
      key: nav?.category ?? null,
      label: null,
      href: null,
      nav: nav ?? null,
      nextUrl,
    });
    router.push(nextUrl);
  };

  const handleLoginClick = () => {
    logEvent("login_start", { page: "home", source: "home_header" });
    window.location.href = kakaoLoginUrl("/");
  };

  const handleLogoutClick = () => {
    logEvent("logout", { page: "home", source: "home_header" });
    window.location.href = "/api/auth/kakao/logout";
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: "calc(102px + env(safe-area-inset-bottom, 0px))",
        overflowX: "visible",
        background: pageBackground,
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
          padding: `4px ${space.pageX}px 0`,
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
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
        <div style={{ animation: "hamaFadeUp 360ms ease 80ms both", position: "relative", zIndex: 10 }}>
          <div
            style={{
              marginBottom: 12,
              borderRadius: radius.largeCard,
              border: "1.5px solid #FFE0D0",
              background: "linear-gradient(135deg, #FFF8F3 0%, #FFFFFF 100%)",
              padding: "14px 16px",
              boxShadow: "0 6px 16px rgba(255,107,53,0.08)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 900, color: colors.textPrimary, lineHeight: 1.35 }}>
              🎁 오늘 하마 추천 방문 미션
            </div>
            <p
              style={{
                margin: "8px 0 12px",
                fontSize: 13,
                lineHeight: 1.5,
                color: colors.textSecondary,
                fontWeight: 600,
              }}
            >
              하마가 추천한 곳 다녀오고 영수증 인증하면 커피 이벤트에 응모돼요.
            </p>
            <button
              type="button"
              onClick={handleMissionBannerStart}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                padding: "11px 14px",
                background: "#FF6B35",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              추천 받고 미션 시작하기
            </button>
          </div>
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 120ms both", position: "relative", zIndex: 10 }}>
          <HomeHero
            onSubmitQuery={(q) => {
              logEvent(HamaEvents.home_scenario_submit, { query: q, page: "home", source: "hero_natural_input" });
              goResults(q, "hero_natural_input");
            }}
          />
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 180ms both", position: "relative", zIndex: 10, marginBottom: 14 }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              fontWeight: 800,
              color: colors.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            이럴 때 하마에게 골라달라고 해보세요
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {SCENARIO_QUICK_CHIPS.map((chip) => (
              <button
                key={chip.scenario}
                type="button"
                onClick={() => goSearch(chip.query, "scenario_quick", chip.scenario)}
                style={{
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 12,
                  background: "#fff",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                }}
              >
                {chip.scenario}
              </button>
            ))}
          </div>
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 240ms both", position: "relative", zIndex: 10 }}>
          <QuickScenarioGrid
            onPick={(q, nav) => {
              logEvent(HamaEvents.home_quick_scenario, {
                query: q,
                page: "home",
                explicit_intent: nav?.intent ?? null,
                explicit_category: nav?.category ?? null,
                explicit_mode: nav?.mode ?? null,
              });
              goResults(q, "quick_grid", nav);
            }}
          />
        </div>
        {activeMission && !activeMission.verified && (
          <div
            id="hama-active-mission"
            style={{
              animation: "hamaFadeUp 360ms ease 300ms both",
              position: "relative",
              zIndex: 10,
              marginTop: 14,
              marginBottom: 14,
              borderRadius: radius.largeCard,
              border: `1px solid ${colors.borderSubtle}`,
              background: "#fff",
              padding: "14px 16px",
              boxShadow: "0 6px 16px rgba(37,99,235,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}>진행 중인 방문 미션</div>
            <p style={{ margin: "8px 0 12px", fontSize: 14, lineHeight: 1.5, color: colors.textPrimary, fontWeight: 700 }}>
              {activeMission.placeName} 다녀오셨나요?
              <br />
              <span style={{ fontWeight: 600, color: colors.textSecondary, fontSize: 13 }}>
                영수증 인증하고 이벤트 응모하세요.
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                logEvent("mission_receipt_click", {
                  placeName: activeMission.placeName,
                  placeId: activeMission.placeId ?? null,
                  page: "home",
                });
                // TODO: 전용 영수증 업로드 UI — 현재는 /receipt 안내 페이지로 연결
                router.push(RECEIPT_VERIFY_PATH);
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                padding: "11px 14px",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              영수증 인증하기
            </button>
          </div>
        )}
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

function HomeEntryGate() {
  const router = useRouter();
  const { user: meUser, isLoggedIn, loading: meLoading } = useHamaMe();
  const [hydrated, setHydrated] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [showLegacyPrompt, setShowLegacyPrompt] = useState(false);
  const [showPromptBadge, setShowPromptBadge] = useState(false);
  const [showExperimentIntro, setShowExperimentIntro] = useState(false);
  const redirectOnceRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || meLoading) return;

    if (!isLoggedIn) {
      setShowExperimentIntro(false);
      setGateReady(true);
      logSurveyGate({ phase: "ready", loggedIn: false, reason: "not_logged_in" });
      return;
    }

    const introSeen = localStorage.getItem(EXPERIMENT_INTRO_SEEN_KEY) === "1";
    setShowExperimentIntro(!introSeen);

    const localCompletedAt = readLocalOnboardingCompletedAt();
    if (localCompletedAt) {
      clearNewUserCookie();
      setShowLegacyPrompt(false);
      setShowPromptBadge(false);
      setGateReady(true);
      logSurveyGate({
        phase: "ready",
        loggedIn: true,
        completed: true,
        source: "local_cache",
        localCompletedAt,
        kakaoInApp: isKakaoInAppBrowser(),
      });
      return;
    }

    const isNewUser = getCookie(NEW_USER_COOKIE) === "1";
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store", credentials: "include" });
        const json = res.ok ? ((await res.json().catch(() => null)) as { user_profile?: unknown } | null) : null;
        const profile = parseUserProfile(json?.user_profile);
        const completed = isSurveyCompletedResolved(profile);

        logSurveyGate({
          phase: "profile_loaded",
          httpOk: res.ok,
          status: res.status,
          isNewUser,
          completed,
          serverCompletedAt: profile.onboarding_completed_at,
          localCompletedAt: readLocalOnboardingCompletedAt(),
          kakaoInApp: isKakaoInAppBrowser(),
        });

        if (cancelled) return;

        if (completed) {
          markOnboardingCompletedLocally(profile);
          setShowLegacyPrompt(false);
          setShowPromptBadge(false);
          setGateReady(true);
          return;
        }

        if (isNewUser && !redirectOnceRef.current) {
          redirectOnceRef.current = true;
          const target = "/onboarding?return_to=%2F";
          logSurveyRedirect({ target, reason: "new_user_incomplete", isNewUser: true, completed: false });
          router.replace(target);
          return;
        }

        if (!isNewUser) {
          const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "1";
          setShowLegacyPrompt(!dismissed);
          setShowPromptBadge(dismissed);
        }
        setGateReady(true);
      } catch (e) {
        console.error("[home] profile check failed", e);
        logSurveyGate({
          phase: "profile_error",
          isNewUser,
          error: e instanceof Error ? e.message : "unknown",
          localCompletedAt: readLocalOnboardingCompletedAt(),
          kakaoInApp: isKakaoInAppBrowser(),
        });
        if (cancelled) return;
        if (!readLocalOnboardingCompletedAt()) {
          const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "1";
          setShowLegacyPrompt(!dismissed && !isNewUser);
          setShowPromptBadge(dismissed && !isNewUser);
        }
        setGateReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, meLoading, isLoggedIn, router]);

  const isBootstrapping = !hydrated || meLoading || (isLoggedIn && !gateReady);

  if (isBootstrapping) {
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
              logEvent("login_start", { page: "home", source: "home_gate" });
              window.location.href = kakaoLoginUrl("/");
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
            bottom: "calc(94px + env(safe-area-inset-bottom, 0px))",
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
      {showExperimentIntro && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "rgba(2,6,23,0.62)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 16,
              background: "#fff",
              padding: 18,
              boxShadow: "0 14px 28px rgba(2,6,23,0.22)",
            }}
          >
            <div style={{ margin: 0, lineHeight: 1.68, color: "#0f172a", fontSize: 14 }}>
              <div style={{ marginBottom: 8, fontWeight: 700, color: "#334155" }}>✍️ 마케팅 느낌 버전</div>
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                {"안녕하세요. 하마입니다.\n\nAI는 점점 똑똑해지고 있지만,\n정작 \"오늘 뭐 먹지?\", \"어디 갈까?\" 같은\n일상의 결정은 여전히 번거롭고 어렵습니다.\n\n그래서 직접 만들어봤습니다."}
              </p>
              <p style={{ margin: "10px 0 0", fontWeight: 900, whiteSpace: "pre-line" }}>
                {"AI가 우리의 일상적인 선택까지 도와줄 수 있을지,\n실제로 검증해보는 서비스입니다."}
              </p>
              <p style={{ margin: "10px 0 0", whiteSpace: "pre-line" }}>
                {"하마는\n복잡한 검색 대신,\n당신의 상황에 맞는 선택을 딱 골라주는 것을 목표로 합니다.\n\n그리고 이 실험은\n여러분의 실제 선택 데이터를 통해 점점 더 똑똑해집니다.\n\n지금 직접 경험해보세요.\n생각보다 더 편해질지도 모릅니다."}
              </p>
              <p style={{ margin: "12px 0 0", textAlign: "right", color: "#475569", fontWeight: 700 }}>
                — 하마 드림
              </p>
            </div>
            <button
              type="button"
              style={{
                marginTop: 14,
                width: "100%",
                border: "none",
                borderRadius: 12,
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                padding: "12px 14px",
                cursor: "pointer",
              }}
              onClick={() => {
                localStorage.setItem(EXPERIMENT_INTRO_SEEN_KEY, "1");
                setShowExperimentIntro(false);
              }}
            >
              실험 참여하기
            </button>
          </div>
        </div>
      )}
      <HomePageContent isLoggedIn={isLoggedIn} meUser={meUser} />
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
