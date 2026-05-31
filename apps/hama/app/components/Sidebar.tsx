"use client";

import React from "react";
import { useRouter } from "next/navigation";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: open ? 0 : "-80%",
        width: "80%",
        height: "100vh",
        background: "#bfe1ff",
        boxShadow: "2px 0 12px rgba(0,0,0,0.2)",
        transition: "left 0.25s ease-out",
        padding: "20px 16px",
        zIndex: 2000,
        fontFamily: "Noto Sans KR",
      }}
    >
      {/* 상단 메뉴 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 26,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        메뉴
      </div>

      {/* 메뉴 리스트 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={itemStyle} onClick={() => go("/calendar")}>
          📅 캘린더 - 여행이나 계획을 기록하세요
        </div>
        <div style={itemStyle} onClick={() => go("/search?query=" + encodeURIComponent("아이랑 갈만한 곳"))}>
          🔍 추천 검색 — 상황에 맞는 장소 찾기
        </div>
        <div style={itemStyle} onClick={() => go("/pay")}>
          💳 HAMA Pay - 포인트 및 결제
        </div>
        <div style={itemStyle} onClick={() => go("/settings")}>
          ⚙️ Settings - App theme, notification, version info
        </div>
      </div>
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  background: "#ffffff",
  padding: "14px 16px",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 500,
  boxShadow: "0px 3px 10px rgba(0,0,0,0.12)",
  cursor: "pointer",
};
