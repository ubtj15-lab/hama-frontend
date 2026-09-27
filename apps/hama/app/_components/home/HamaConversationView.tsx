"use client";

import React, { useEffect, useRef, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { OpenExplorationMapButton } from "@/map/OpenExplorationMapButton";

const GREEN = "#19584A";
const MUTED = "#7E948C";
const LINE = "#D5E3DC";
const BUBBLE = "#E4EFE8";

type ChatEntry = {
  turnId?: string;
  userText: string;
  assistantText?: string;
  playCards: HomeCard[];
  foodCards: HomeCard[];
  anchorName?: string | null;
  provisional?: boolean;
  current: boolean;
  loading: boolean;
  showFood: boolean;
  foodLoading: boolean;
  blockedMessage?: string | null;
  foodBlocked?: boolean;
  foodUnavailableMessage?: string | null;
  animatePlay?: boolean;
  animateFood?: boolean;
};

type Props = {
  entries: ChatEntry[];
  playChoices: HomeCard[];
  onPickAnchor: (id: string) => void;
  onOpen: (card: HomeCard) => void;
  onReject: (id: string) => void;
};

export function HamaConversationView({ entries, playChoices, onPickAnchor, onOpen, onReject }: Props) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const last = entries[entries.length - 1]?.userText ?? "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [last, entries.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 18 }}>
      <style>{`
        @keyframes hamaTurnIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes hamaCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes hamaSearchPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        .hama-turn-current > .hama-user-line,
        .hama-turn-current > .hama-assistant-line {
          animation: hamaTurnIn 280ms ease;
        }
        .hama-result-enter {
          animation: hamaCardIn 360ms ease;
        }
        .hama-search-status {
          animation: hamaSearchPulse 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hama-turn-current > .hama-user-line,
          .hama-turn-current > .hama-assistant-line,
          .hama-result-enter,
          .hama-search-status {
            animation: none;
          }
        }
      `}</style>
      {entries.map((entry, index) => {
        const expanded = entry.current || opened[entry.userText] === true;
        const playCount = entry.playCards.length;
        return (
          <section
            key={`${entry.turnId ?? entry.userText}-${index}`}
            className={entry.current ? "hama-turn-current" : undefined}
            data-hama-turn={entry.userText}
            data-hama-turn-id={entry.turnId ?? ""}
            data-hama-play-ids={entry.playCards.map((card) => card.id).join("|")}
            data-hama-food-ids={(entry.foodCards ?? []).map((card) => card.id).join("|")}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div
              className="hama-user-line"
              style={{
                alignSelf: "flex-end",
                maxWidth: "84%",
                padding: "10px 14px",
                borderRadius: 16,
                background: BUBBLE,
                color: GREEN,
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {entry.userText}
            </div>
            {entry.assistantText ? (
              <p className={entry.current ? "hama-assistant-line" : undefined} style={{ margin: 0, color: GREEN, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{entry.assistantText}</p>
            ) : null}
            {entry.loading ? (
              <p className="hama-search-status" data-hama-search-status="" style={{ margin: 0, color: MUTED, fontSize: 14 }}>
                골라보는 중이에요.
              </p>
            ) : null}
            {entry.blockedMessage ? (
              <p data-hama-suppression-error="" style={{ margin: 0, color: GREEN, fontSize: 14, lineHeight: 1.5 }}>
                {entry.blockedMessage}
              </p>
            ) : null}
            {playCount > 0 && !expanded ? (
              <button
                type="button"
                onClick={() => setOpened((current) => ({ ...current, [entry.userText]: true }))}
                style={textButton}
              >
                추천 {playCount}곳 다시 보기
              </button>
            ) : null}
            {playCount > 0 && expanded ? (
              <div
                className={entry.animatePlay ? "hama-result-enter" : undefined}
                data-hama-play-list={entry.current ? "" : undefined}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {!entry.current ? (
                  <button
                    type="button"
                    onClick={() => setOpened((current) => ({ ...current, [entry.userText]: false }))}
                    style={textButton}
                  >
                    접기
                  </button>
                ) : null}
                <OpenExplorationMapButton cards={entry.playCards} />
                {entry.playCards.map((card) => (
                  <PlaceCard key={card.id} card={card} onOpen={onOpen} onReject={entry.current ? onReject : undefined} />
                ))}
              </div>
            ) : null}
            {entry.showFood ? (
              <section aria-label="식사 추천" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 style={{ margin: 0, color: GREEN, fontSize: 15, fontWeight: 700 }}>식사</h2>
                {entry.anchorName ? (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.45 }}>
                    {entry.provisional ? `임시 기준은 첫 놀이 장소인 ${entry.anchorName}예요. ` : `거리 기준은 ${entry.anchorName}예요. `}
                    표시된 거리는 직선거리이고, 실제 이동시간이 아닙니다.
                  </p>
                ) : null}
                {entry.current && playChoices.length > 1 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {playChoices.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onPickAnchor(card.id)}
                        style={{
                          border: `1px solid ${LINE}`,
                          background: "#fff",
                          color: GREEN,
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {card.name} 기준
                      </button>
                    ))}
                  </div>
                ) : null}
                {entry.foodLoading ? (
                  <p className="hama-search-status" data-hama-food-search-status="" style={{ margin: 0, color: MUTED, fontSize: 14 }}>
                    식당을 고르는 중이에요.
                  </p>
                ) : null}
                {!entry.foodLoading && entry.foodBlocked ? (
                  <p data-hama-food-suppression-error="" style={{ margin: 0, color: GREEN, fontSize: 14, lineHeight: 1.5 }}>
                    가게 확인에 실패해서 식사 추천을 보여드리지 않았어요. 잠시 후 다시 시도해 주세요.
                  </p>
                ) : null}
                {!entry.foodLoading && !entry.foodBlocked && entry.foodUnavailableMessage ? (
                  <p data-hama-food-recommend-error="" style={{ margin: 0, color: GREEN, fontSize: 14, lineHeight: 1.5 }}>
                    {entry.foodUnavailableMessage}
                  </p>
                ) : null}
                {!entry.foodLoading && !entry.foodBlocked && !entry.foodUnavailableMessage && entry.foodCards.length === 0 ? (
                  <p style={{ margin: 0, color: GREEN, fontSize: 14 }}>조건에 맞는 식당이 없어요.</p>
                ) : null}
                {expanded && entry.foodCards.length > 0 ? (
                  <div className={entry.animateFood ? "hama-result-enter" : undefined} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {entry.foodCards.map((card, foodIndex) => (
                      <div key={card.id} data-hama-food-id={entry.current ? card.id : undefined}>
                        <PlaceCard
                          card={card}
                          onOpen={onOpen}
                          extra={
                            entry.anchorName && typeof card.distanceKm === "number" && Number.isFinite(card.distanceKm)
                              ? `${foodIndex + 1}. 직선거리 ${card.distanceKm.toFixed(1)}km`
                              : null
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </section>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function realImage(card: HomeCard): string | null {
  const raw = card.image_url || card.imageUrl;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

function PlaceCard({
  card,
  onOpen,
  onReject,
  extra,
}: {
  card: HomeCard;
  onOpen: (card: HomeCard) => void;
  onReject?: (id: string) => void;
  extra?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const image = realImage(card);
  const address = String(card.address ?? "").trim();
  const phone = String(card.phone ?? "").trim();
  const reason = String(card.reasonText ?? "").trim();
  const categoryLabel = String(card.categoryLabel ?? "").trim();
  const category = /[가-힣]/.test(categoryLabel) ? categoryLabel : "";

  return (
    <article
      data-hama-place-id={card.id}
      style={{
        background: "#fff",
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      {image ? (
        <img src={image} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
      ) : null}
      <p style={{ margin: 0, color: GREEN, fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>{card.name}</p>
      {category ? <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 13 }}>{category}</p> : null}
      {reason ? (
        <p style={{ margin: "8px 0 0", color: GREEN, fontSize: 14, lineHeight: 1.45 }}>{open ? reason : reason.slice(0, 72)}</p>
      ) : null}
      {extra ? <p style={{ margin: "6px 0 0", color: MUTED, fontSize: 13 }}>{extra}</p> : null}
      {open && address ? <p style={{ margin: "8px 0 0", color: MUTED, fontSize: 13, lineHeight: 1.4 }}>{address}</p> : null}
      {open && phone ? <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 13 }}>{phone}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onOpen(card)} style={textButton}>
          상세 보기
        </button>
        {(address || phone || reason.length > 72) ? (
          <button type="button" onClick={() => setOpen((value) => !value)} style={textButton}>
            {open ? "접기" : "더 보기"}
          </button>
        ) : null}
        {onReject ? (
          <button type="button" onClick={() => onReject(card.id)} style={textButton}>
            다른 곳
          </button>
        ) : null}
      </div>
    </article>
  );
}

const textButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: GREEN,
  fontSize: 13,
  fontWeight: 700,
  padding: 0,
  cursor: "pointer",
};
