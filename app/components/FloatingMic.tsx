"use client";

import React from "react";

export default function FloatingMic() {
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

        // ✅ wrapper는 클릭 절대 먹지 않음
        pointerEvents: "none",

        width: "auto",
        height: "auto",
      }}
    >
      <button
        type="button"
        onClick={onMicClick}
        style={{
          // ✅ 버튼만 클릭 허용
          pointerEvents: "auto",

          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",

          background: "#ffffff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
        aria-label="voice input"
      >
        🎤
      </button>
    </div>
  );
}
