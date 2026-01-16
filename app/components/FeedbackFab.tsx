"use client";

import React from "react";
import { logEvent } from "@/lib/logEvent";

type Props = {
  onClick?: () => void;
};

export default function FeedbackFab({ onClick }: Props) {
  const handleClick = () => {
    logEvent("feedback_fab_click", { from: "home" });
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="피드백 보내기"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 2000,
        border: "none",
        borderRadius: 999,
        padding: "12px 14px",
        background: "#111827",
        color: "#ffffff",
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
        cursor: "pointer",
      }}
    >
      피드백
    </button>
  );
}
