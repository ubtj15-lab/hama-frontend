"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PwaInstallBanner } from "./PwaInstallBanner";
import {
  isMobileViewForPwa,
  isStandaloneMode,
  needsManualHomeScreenGuide,
} from "@/lib/pwa/pwaDevice";
import { isSnoozing, snoozeInstallPrompt } from "@/lib/pwa/pwaStorage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** 개발: 예전에 등록된 SW가 /_next·manifest를 깨뜨리는 경우가 많아 전부 해제 */
async function unregisterAllServiceWorkers(): Promise<number> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return 0;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  return regs.length;
}

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PWA_SW_IN_DEV !== "1") {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

/**
 * 오픈베타 PWA: beforeinstallprompt + 수동 안내 배너 (자동 prompt/시트 없음).
 */
export function PwaClient() {
  const [hydrated, setHydrated] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const canNativeInstall = Boolean(deferred);
  const showManualGuide = needsManualHomeScreenGuide();
  const visible =
    hydrated &&
    !dismissed &&
    !isStandaloneMode() &&
    !isSnoozing() &&
    isMobileViewForPwa() &&
    (canNativeInstall || showManualGuide);

  const handleDismiss = useCallback(() => {
    snoozeInstallPrompt();
    setDismissed(true);
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
      handleDismiss();
    }
  }, [deferred, handleDismiss]);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== "undefined" && isSnoozing()) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const swInDev = process.env.NEXT_PUBLIC_PWA_SW_IN_DEV === "1";
    if (process.env.NODE_ENV !== "production" && !swInDev) {
      void unregisterAllServiceWorkers().then((n) => {
        if (n > 0) {
          console.info(
            `[HAMA PWA] 개발 모드: 이전 service worker ${n}개를 해제했습니다. 새로고침하면 정적 리소스/manifest가 정상 로드됩니다.`
          );
        }
      });
      return;
    }

    registerServiceWorker();
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
    const onInstalled = () => {
      setDeferred(null);
      handleDismiss();
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [handleDismiss]);

  if (isStandaloneMode()) {
    return null;
  }

  return (
    <PwaInstallBanner
      visible={visible}
      canNativeInstall={canNativeInstall}
      showManualGuide={showManualGuide && !canNativeInstall}
      onInstallClick={() => void onInstall()}
      onDismiss={handleDismiss}
    />
  );
}
