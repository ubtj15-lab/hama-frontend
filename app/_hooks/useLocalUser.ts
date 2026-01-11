"use client";

import { useEffect, useRef, useState } from "react";

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

export function useLocalUser() {
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 메뉴 UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 60, left: 10 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const syncLoginState = () => {
    if (typeof window === "undefined") return;
    setUser(loadUserFromStorage());
    setIsLoggedIn(window.localStorage.getItem(LOGIN_FLAG_KEY) === "1");
  };

  useEffect(() => {
    syncLoginState();
    window.addEventListener("pageshow", syncLoginState);
    window.addEventListener("focus", syncLoginState);
    window.addEventListener("storage", syncLoginState);
    return () => {
      window.removeEventListener("pageshow", syncLoginState);
      window.removeEventListener("focus", syncLoginState);
      window.removeEventListener("storage", syncLoginState);
    };
  }, []);

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
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      return updated;
    });
  };

  const logoutLocal = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(LOG_KEY);
    window.localStorage.removeItem(LOGIN_FLAG_KEY);
    setUser({ nickname: "게스트", points: 0 });
    setIsLoggedIn(false);
  };

  const loginLocal = () => {
    if (typeof window === "undefined") return;
    const newUser: HamaUser = { nickname: "카카오 사용자", points: user.points };
    window.localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
    setUser(newUser);
    setIsLoggedIn(true);
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

    setMenuOpen,
    setMenuPos,
  };
}
