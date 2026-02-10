// components/FeedbackFab.tsx
"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";

export default function FeedbackFab() {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ 하단 CTA가 있는 페이지에서는 FAB 숨김
  if (pathname === "/map" || pathname === "/reserve") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/feedback")}
      aria-label="feedback"
      style={{
        position: "fixed",
        right: 18,
        bottom: 22,
        zIndex: 2500,
        width: 56,
        height: 56,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: "linear-gradient(135deg, #2563eb, #4f46e5)",
        boxShadow: "0 16px 32px rgba(37,99,235,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 900,
        fontSize: 16,
      }}
      title="피드백"
    >
      ✎
    </button>
  );
}
