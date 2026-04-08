"use client";

import React, { useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import {
  HOME_TRUST_PICK_MAX,
  TRUST_SCENARIO_SEEDS,
  type TrustScenarioSeed,
  fetchTrustPickPlaceCards,
  pickDiverseHomeCards,
  shortTagsForTrustCard,
} from "@/lib/homeTrustPick";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";

type TrustRow =
  | { kind: "place"; card: HomeCard }
  | { kind: "scenario"; seed: TrustScenarioSeed };

type Props = {
  onPlaceOpen: (card: HomeCard) => void;
  onScenarioGo: (query: string) => void;
};

function thumbPlace(card: HomeCard): string {
  const c = card as Record<string, unknown>;
  const u = String(c.imageUrl ?? c.image_url ?? "").trim();
  if (u) return u;
  return getDefaultCardImage(card);
}

function buildRows(places: HomeCard[]): TrustRow[] {
  const picked = pickDiverseHomeCards(places, HOME_TRUST_PICK_MAX);
  const rows: TrustRow[] = picked.map((card) => ({ kind: "place", card }));
  let i = 0;
  while (rows.length < HOME_TRUST_PICK_MAX && i < TRUST_SCENARIO_SEEDS.length) {
    rows.push({ kind: "scenario", seed: TRUST_SCENARIO_SEEDS[i]! });
    i += 1;
  }
  return rows.slice(0, HOME_TRUST_PICK_MAX);
}

export function HomeTrustPickSection({ onPlaceOpen, onScenarioGo }: Props) {
  const [rows, setRows] = useState<TrustRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await fetchTrustPickPlaceCards(16);
      if (!alive) return;
      setRows(buildRows(raw));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section style={{ marginBottom: space.section }}>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: colors.textPrimary,
          margin: "0 0 12px",
          letterSpacing: "-0.02em",
        }}
      >
        지금 이런 선택 어때?
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: space.chip }}>
        {rows === null &&
          Array.from({ length: HOME_TRUST_PICK_MAX }).map((_, idx) => (
            <div
              key={`sk-${idx}`}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                borderRadius: radius.card,
                background: colors.bgCard,
                border: `1px solid ${colors.borderSubtle}`,
                minHeight: 100,
                alignItems: "center",
                opacity: 0.65,
              }}
            >
              <div style={{ width: 84, height: 84, borderRadius: 14, background: colors.bgMuted }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 16, width: "70%", background: colors.bgMuted, borderRadius: 6, marginBottom: 10 }} />
                <div style={{ height: 12, width: "45%", background: colors.bgMuted, borderRadius: 6 }} />
              </div>
            </div>
          ))}

        {rows !== null &&
          rows.map((row, idx) => {
            if (row.kind === "place") {
              const { card } = row;
              const tags = shortTagsForTrustCard(card);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    logEvent("home_trust_pick", {
                      kind: "place",
                      place_id: card.id,
                      card_rank: idx,
                      page: "home",
                    });
                    onPlaceOpen(card);
                  }}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    borderRadius: radius.card,
                    background: colors.bgCard,
                    border: `1px solid ${colors.borderSubtle}`,
                    boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
                    cursor: "pointer",
                    textAlign: "left",
                    alignItems: "center",
                  }}
                >
                  <Thumbnail src={thumbPlace(card)} alt="" size={84} radius={14} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...typo.cardTitle, fontSize: 16, color: colors.textPrimary, lineHeight: 1.3 }}>
                      {(card.name || "추천 장소").slice(0, 28)}
                      {(card.name?.length ?? 0) > 28 ? "…" : ""}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: colors.textSecondary,
                            background: colors.bgMuted,
                            padding: "4px 9px",
                            borderRadius: radius.pill,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            }

            const { seed } = row;
            return (
              <button
                key={seed.id}
                type="button"
                onClick={() => {
                  logEvent("home_trust_pick", { kind: "scenario", query: seed.query, card_rank: idx, page: "home" });
                  onScenarioGo(seed.query);
                }}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  borderRadius: radius.card,
                  background: colors.bgCard,
                  border: `1px solid ${colors.borderSubtle}`,
                  boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
                  cursor: "pointer",
                  textAlign: "left",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 14,
                    flexShrink: 0,
                    background: `linear-gradient(145deg, #e0e7ff 0%, #fae8ff 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                  aria-hidden
                >
                  ✨
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...typo.cardTitle, fontSize: 16, color: colors.textPrimary, lineHeight: 1.3 }}>
                    {seed.title}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {seed.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.textSecondary,
                          background: colors.bgMuted,
                          padding: "4px 9px",
                          borderRadius: radius.pill,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}
