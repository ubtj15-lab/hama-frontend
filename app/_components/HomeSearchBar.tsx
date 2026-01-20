"use client";

import React from "react";

type Props = {
  query: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export default function HomeSearchBar({ query, onChange, onSubmit }: Props) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 999,
        padding: "10px 12px",
        boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
        marginBottom: 14,
        background: "#ffffff",
      }}
    >
      <span style={{ fontSize: 16 }}>🔎</span>

      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="근처 카페 찾아줘 / 점심 뭐 먹지"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          fontSize: 14.5,
          fontWeight: 600,
          background: "transparent",
          padding: "0 2px",
        }}
      />

      <button
        type="submit"
        style={{
          height: 36,
          padding: "0 16px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(135deg, #38bdf8, #2563eb)",
          color: "#ffffff",
          fontWeight: 800,
          boxShadow: "0 10px 18px rgba(37,99,235,0.22)",
        }}
      >
        검색
      </button>
    </form>
  );
}
