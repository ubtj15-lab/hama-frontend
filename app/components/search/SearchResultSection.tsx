"use client";

import React from "react";
import type { Place } from "@lib/storeTypes";
import SearchResultList from "./SearchResultList";

interface Props {
  results: Place[];
}

export default function SearchResultSection({ results }: Props) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
        검색 결과
      </div>

      <SearchResultList results={results} />
    </section>
  );
}
