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
  const [todayAskCount, setTodayAskCount] = useState<number | null>(null);
  const { recentCards, recordView } = useRecent();

  const openId = searchParams.get("open");

  useEffect(() => {
    const sync = () => {
      setUser(loadUserFromStorage());
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
        <div style={{ animation: "hamaFadeUp 360ms ease both" }}>
          <HomeTopBar
            onAlertClick={() => {
              logEvent("home_alert_click", { page: "home" });
            }}
          />
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 120ms both" }}>
          <HomeHero />
        </div>
        <div style={{ animation: "hamaFadeUp 360ms ease 240ms both" }}>
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
