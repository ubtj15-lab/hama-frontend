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
        right: 20,
        bottom: 20,
        zIndex: 9999,

        // ✅ 핵심: wrapper는 클릭을 절대 먹지 않게
        pointerEvents: "none",

        // ✅ 전체 화면 덮는 스타일 방지
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
          borderRadius: 9999,
          border: "none",
          cursor: "pointer",

          // 보기 스타일(원하면 유지/수정)
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
