"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { HomeCard } from "@/lib/storeTypes";
import { EXPLORATION_MAP_SOURCE, HAMA_MAP_GREEN_DEEP, HAMA_MAP_IVORY } from "@/lib/map/explorationPlaces";
import { stashExplorationCards } from "@/lib/map/explorationSession";

type Props = {
  cards: readonly HomeCard[];
};

/** Hands the current recommendation order to the map. Does not sort or rescore. */
export function OpenExplorationMapButton({ cards }: Props) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        stashExplorationCards(cards);
        router.push(`/map?source=${EXPLORATION_MAP_SOURCE}`);
      }}
      style={{
        margin: "0 0 12px",
        height: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${HAMA_MAP_GREEN_DEEP}`,
        background: HAMA_MAP_IVORY,
        color: HAMA_MAP_GREEN_DEEP,
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      지도에서 보기
    </button>
  );
}
