"use client";

import React from "react";
import type { Place } from "../../search/page";
import SearchResultList from "./SearchResultList";

interface Props {
  results: Place[];
  viewMode: "preview" | "list";
  setViewMode: (mode: "preview" | "list") => void;
  isLoading: boolean;
}

export default function SearchResultSection({
  results,
  viewMode,
  setViewMode,
  isLoading,
}: Props) {
  const count = results.length;

  return (
    <section style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          검색 결과{" "}
          {isLoading ? "불러오는 중..." : `${count}곳`}
        </h3>

        {count > 3 && (
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "list" ? "preview" : "list")
            }
            style={{
              border: "none",
              background: "transparent",
              fontSize: 11,
              color: "#6b7280",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {viewMode === "list" ? "3개만 보기" : "전체 보기"}
          </button>
        )}
      </div>

      {count === 0 && !isLoading ? (
        <div
          style={{
            borderRadius: 16,
            padding: 16,
            background: "#f9fafb",
            fontSize: 12,
            color: "#4b5563",
          }}
        >
          딱 맞는 결과는 없었어요.  
          대신 위의 추천 카드나  
          “카페만 보기 / 식당만 보기” 버튼으로 좁혀볼 수 있어요.
        </div>
      ) : (
        <SearchResultList
          results={
            viewMode === "preview"
              ? results.slice(0, 3)
              : results
          }
        />
      )}
    </section>
  );
}
