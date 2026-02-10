"use client";

import React from "react";
import { useUIOverlay } from "../_providers/UIOverlayProvider";

export default function FloatingMic() {
  const { overlayOpen } = useUIOverlay();

  // ✅ 카드 상세/오버레이 떠 있으면 마이크 숨김
  if (overlayOpen) return null;

  const onMicClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("mic click");
    // TODO: mic action
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 9999,

        // ✅ wrapper는 클릭을 먹지 않게
        pointerEvents: "none",

        width: "auto",
        height: "auto",
      }}
    >
      <button
        type="button"
        onClick={onMicClick}
        style={{
          pointerEvents: "auto",
          width: 72,
          height: 72,
          borderRadius: 9999,
          border: "none",
          cursor: "pointer",
          background: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
        aria-label="voice input"
      >
        🎤
      </button>
    </div>
  );
}
