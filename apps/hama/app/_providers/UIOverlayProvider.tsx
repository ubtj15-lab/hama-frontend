"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type UIOverlayState = {
  overlayOpen: boolean;
  setOverlayOpen: (v: boolean) => void;
};

const UIOverlayContext = createContext<UIOverlayState | null>(null);

export function UIOverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const value = useMemo(
    () => ({ overlayOpen, setOverlayOpen }),
    [overlayOpen]
  );

  return <UIOverlayContext.Provider value={value}>{children}</UIOverlayContext.Provider>;
}

export function useUIOverlay() {
  const ctx = useContext(UIOverlayContext);
  if (!ctx) throw new Error("useUIOverlay must be used within UIOverlayProvider");
  return ctx;
}
