// app/components/HeaderMenu.tsx
"use client";

import React from "react";

// 아주 심플한 버튼 컴포넌트 (shadcn 없이)
type SimpleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function SimpleButton({ className = "", ...props }: SimpleButtonProps) {
  return (
    <button
      {...props}
      className={
        "rounded-full px-3 py-1 text-sm font-medium bg-white text-slate-900 shadow " +
        className
      }
    />
  );
}

// 하마 상단 메뉴 (필요하면 나중에 더 예쁘게 꾸미자)
export default function HeaderMenu() {
  return (
    <header
      style={{
        width: "100%",
        maxWidth: 430,
        margin: "0 auto",
        padding: "12px 16px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700 }}>HAMA</div>
      <SimpleButton>메뉴</SimpleButton>
    </header>
  );
}
