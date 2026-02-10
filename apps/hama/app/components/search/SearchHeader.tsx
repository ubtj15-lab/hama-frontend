"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface Props {
  query: string;
  onChangeQuery: (v: string) => void;
  onSubmit: (v: string) => void;
}

export default function SearchHeader({
  query,
  onChangeQuery,
  onSubmit,
}: Props) {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(query.trim());
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="뒤로가기"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "none",
          background: "#ffffff",
          boxShadow: "0 3px 8px rgba(15,23,42,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ←
      </button>

      <form
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          background: "#ffffff",
          borderRadius: 999,
          padding: "0 6px 0 16px",
          boxShadow: "0 6px 16px rgba(15,23,42,0.18)",
        }}
      >
        <input
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          placeholder="다시 검색해볼까요?"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            height: 40,
            fontSize: 14,
            background: "transparent",
          }}
        />
        <button
          type="submit"
          style={{
            border: "none",
            borderRadius: 999,
            padding: "0 16px",
            height: 32,
            marginRight: 4,
            background: "linear-gradient(135deg,#2563eb,#4f46e5)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          검색
        </button>
      </form>
    </header>
  );
}
