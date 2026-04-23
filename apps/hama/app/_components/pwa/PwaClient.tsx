"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PwaInstallSheet } from "./PwaInstallSheet";
import { isIosBrowser, isMobileViewForPwa, isStandaloneMode } from "@/lib/pwa/pwaDevice";
import {
  ELIGIBLE_SESSION_OPENS,
  SHOW_DELAY_MS,
  atPromptLimit,
  getSessionOpenCount,
  hasPwaEngagement,
  incrementPromptShownCount,
  isSnoozing,
  maybeIncrementSessionOpen,
  snoozeInstallPrompt,
} from "@/lib/pwa/pwaStorage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PWA_SW_IN_DEV !== "1") {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

function shouldOfferInstall(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneMode()) return false;
  if (!isMobileViewForPwa()) return false;
  if (isSnoozing()) return false;
  if (atPromptLimit()) return false;
  const sessions = getSessionOpenCount();
  const engaged = hasPwaEngagement();
  return sessions >= ELIGIBLE_SESSION_OPENS || engaged;
}

/**
 * PWA: 세션·스토리지·beforeinstallprompt 기반 설치 안내 (강제 없음, 모바일만).
 * 홈/추천 흐름 — 오버레이 z-index 400. standalone 이면 UI 없음.
 */
export function PwaClient() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const scheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownThisScheduleRef = useRef(false);
  openRef.current = open;

  const canNativeInstall = Boolean(deferred);

  const clearSchedule = useCallback(() => {
    if (scheduleRef.current) {
      clearTimeout(scheduleRef.current);
      scheduleRef.current = null;
    }
  }, []);

  const tryScheduleOpen = useCallback(() => {
    if (isStandaloneMode()) return;
    if (!shouldOfferInstall()) return;
    if (openRef.current) return;
    if (hasShownThisScheduleRef.current) return;

    clearSchedule();
    scheduleRef.current = setTimeout(() => {
      scheduleRef.current = null;
      if (!shouldOfferInstall() || isStandaloneMode()) return;
      hasShownThisScheduleRef.current = true;
      setOpen(true);
      incrementPromptShownCount();
    }, SHOW_DELAY_MS);
  }, [clearSchedule]);

  const handleSnooze = useCallback(() => {
    snoozeInstallPrompt();
    setOpen(false);
    hasShownThisScheduleRef.current = true;
  }, []);

  const handleDismiss = useCallback(() => {
    snoozeInstallPrompt();
    setOpen(false);
    hasShownThisScheduleRef.current = true;
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* no-op */
    } finally {
      setDeferred(null);
      setOpen(false);
      hasShownThisScheduleRef.current = true;
    }
  }, [deferred]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) return;
    maybeIncrementSessionOpen();
  }, []);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    const onEngage = () => {
      tryScheduleOpen();
    };
    window.addEventListener("hama-pwa-engaged", onEngage);
    return () => window.removeEventListener("hama-pwa-engaged", onEngage);
  }, [tryScheduleOpen]);

  useEffect(() => {
    if (isStandaloneMode()) return;
    tryScheduleOpen();
    return () => clearSchedule();
  }, [pathname, tryScheduleOpen, clearSchedule]);

  if (isStandaloneMode()) {
    return null;
  }

  return (
    <PwaInstallSheet
      open={open}
      isIos={isIosBrowser()}
      onSnooze={handleSnooze}
      onDismiss={handleDismiss}
      onInstallClick={onInstall}
      canNativeInstall={canNativeInstall}
    />
  );
}
