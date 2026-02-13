"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export default function SideMenu({
  isOpen,
  onClose,
  isLoggedIn,
  onLogin,
  onLogout,
}: SideMenuProps) {
  const router = useRouter();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: isOpen ? 0 : "-100%",
        width: "260px",
        height: "100vh",
        background: "#ffffff",
        boxShadow: "2px 0 18px rgba(0,0,0,0.15)",
        transition: "left 0.28s ease",
        zIndex: 9999,
        padding: "24px 18px",
        boxSizing: "border-box",
      }}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          fontSize: 22,
          cursor: "pointer",
          marginBottom: 28,
        }}
      >
        ✕
      </button>

      {/* 메뉴 리스트 */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontSize: 15,
        }}
      >
        {/* 베타 안내 사항 */}
        <li>
          <Link
            href="/beta-info"
            onClick={onClose}
            style={{
              display: "block",
              padding: "10px 0",
              color: "#1f2937",
              textDecoration: "none",
            }}
          >
            🦛 베타 안내
          </Link>
        </li>

        {/* 마이페이지 */}
        <li>
          <Link
            href="/mypage"
            onClick={onClose}
            style={{
              display: "block",
              padding: "10px 0",
              color: "#1f2937",
              textDecoration: "none",
            }}
          >
            👤 마이페이지
          </Link>
        </li>

        {/* 설정 */}
        <li>
          <Link
            href="/settings"
            onClick={onClose}
            style={{
              display: "block",
              padding: "10px 0",
              color: "#1f2937",
              textDecoration: "none",
            }}
          >
            ⚙️ 설정
          </Link>
        </li>

        {/* 로그인 상태에 따른 버튼 */}
        <li>
          {isLoggedIn ? (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 0",
                background: "none",
                border: "none",
                color: "#1f2937",
                cursor: "pointer",
              }}
            >
              🚪 로그아웃
            </button>
          ) : (
            <button
              onClick={() => {
                onLogin();
                onClose();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 0",
                background: "none",
                border: "none",
                color: "#1f2937",
                cursor: "pointer",
              }}
            >
              💛 카카오로 로그인
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
