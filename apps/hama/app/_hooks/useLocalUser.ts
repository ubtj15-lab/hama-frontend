"use client";

import { useEffect, useRef, useState } from "react";
import { kakaoLoginUrl } from "@/lib/auth/kakaoLogin";
import { useHamaMe } from "@/lib/auth/useHamaMe";

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

function loadGuestPointsFromStorage(): HamaUser {
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

function saveGuestPointsToStorage(user: HamaUser) {
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

export function useLocalUser() {
  const { user: meUser, isLoggedIn, refresh } = useHamaMe();
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });

  useEffect(() => {
    if (meUser) {
      setUser({ nickname: meUser.nickname, points: meUser.points });
    } else {
      setUser(loadGuestPointsFromStorage());
    }
  }, [meUser]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 60, left: 10 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const updateMenuPosition = () => {
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left });
  };

  useEffect(() => {
    if (menuOpen) updateMenuPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => menuOpen && updateMenuPosition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  const toggleMenu = () => setMenuOpen((p) => !p);
  const closeMenu = () => setMenuOpen(false);

  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      if (!isLoggedIn) saveGuestPointsToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  const logoutLocal = () => {
    window.location.href = "/api/auth/kakao/logout";
  };

  const loginLocal = () => {
    window.location.href = kakaoLoginUrl("/");
  };

  return {
    user,
    isLoggedIn,

    menuOpen,
    menuPos,
    menuButtonRef,

    toggleMenu,
    closeMenu,

    addPoints,
    logoutLocal,
    loginLocal,
    refreshMe: refresh,

    setMenuOpen,
    setMenuPos,
  };
}
