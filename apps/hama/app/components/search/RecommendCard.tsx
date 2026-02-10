"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";

type Props = {
  place: HomeCard;
  onClick?: (place: HomeCard) => void;
};

function getImageUrl(place: HomeCard): string | null {
  const anyPlace = place as any;
  return (anyPlace.imageUrl ?? anyPlace.image_url ?? anyPlace.image ?? null) as string | null;
}

function getMoodText(place: HomeCard): string {
  const anyPlace = place as any;

  // 우선순위: moodText(문자열) > mood(배열) > "".
  if (typeof anyPlace.moodText === "string" && anyPlace.moodText.trim()) return anyPlace.moodText.trim();

  const mood = anyPlace.mood;
  if (Array.isArray(mood)) return mood.filter(Boolean).join(" · ");

  if (typeof mood === "string") return mood;

  return "";
}

export default function RecommendCard({ place, onClick }: Props) {
  const anyPlace = place as any;

  const name = anyPlace?.name ?? "";
  const categoryLabel = anyPlace?.categoryLabel ?? anyPlace?.category ?? "";
  const area = anyPlace?.area ?? "";
  const address = anyPlace?.address ?? "";
  const moodText = getMoodText(place);

  const imageUrl = getImageUrl(place);

  const handleClick = () => {
    logEvent("search_recommend_card_click", { id: anyPlace?.id ?? null, name });
    onClick?.(place);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        width: "100%",
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 10px 25px rgba(15,23,42,0.12)",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 14,
            overflow: "hidden",
            background: "#e5e7eb",
            position: "relative",
            flex: "0 0 auto",
          }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name || "place"}
              fill
              sizes="84px"
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#0f172a",
              lineHeight: 1.2,
              marginBottom: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
            {categoryLabel}
            {area ? ` · ${area}` : ""}
          </div>

          {address ? (
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: moodText ? 6 : 0,
              }}
            >
              {address}
            </div>
          ) : null}

          {moodText ? (
            <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>{moodText}</div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
