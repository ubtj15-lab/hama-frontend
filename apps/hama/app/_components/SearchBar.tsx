"use client";

import React from "react";

export default function SearchBar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        background: "#ffffff",
        borderRadius: 999,
        padding: "0 10px 0 18px",
        boxShadow: "0 14px 30px rgba(15,23,42,0.16), 0 0 0 1px rgba(148,163,184,0.12)",
        marginBottom: 22,
      }}
    >
      <span style={{ fontSize: 18, marginRight: 8 }}>🔍</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="근처 카페 찾아줘 / 점심 뭐 먹지"
        style={{ flex: 1, border: "none", outline: "none", height: 46, fontSize: 15, background: "transparent" }}
      />
      <button
        type="submit"
        style={{
          border: "none",
          borderRadius: 999,
          padding: "0 18px",
          height: 34,
          marginLeft: 4,
          background: "linear-gradient(135deg, #2563eb, #4f46e5)",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 6px 14px rgba(37,99,235,0.45)",
        }}
      >
        검색
      </button>
    </form>
  );
}
