"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { OpenExplorationMapButton } from "@/map/OpenExplorationMapButton";
import { HamaSwipeDeck } from "./HamaSwipeDeck";
import { HamaPlaceDetailPanel } from "./HamaPlaceDetailPanel";

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
  playRefreshNote?: string | null;
  animatePlay?: boolean;
  animateFood?: boolean;
};

type Props = {
  entries: ChatEntry[];
  playChoices: HomeCard[];
  onPickAnchor: (id: string) => void;
  onReject: (id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  quiet?: boolean;
  initialScrollTop?: number;
  initialOpened?: Record<string, boolean>;
  initialSelected?: Record<string, number>;
  transcriptRef?: React.MutableRefObject<{ scrollTop: number; opened: Record<string, boolean>; selected: Record<string, number> } | null>;
};

function turnDeckKey(entry: { turnId?: string; userText: string }, kind: "play" | "food") {
  return `${entry.turnId || entry.userText}:${kind}`;
}

const PIN_THRESHOLD = 72;

function distanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function HamaConversationView({
  entries,
  playChoices,
  onPickAnchor,
  onReject,
  onRefresh,
  refreshing = false,
  quiet = false,
  initialScrollTop,
  initialOpened,
  initialSelected,
  transcriptRef,
}: Props) {
  const [opened, setOpened] = useState<Record<string, boolean>>(initialOpened ?? {});
  const [selected, setSelected] = useState<Record<string, number>>(initialSelected ?? {});
  const [detailCard, setDetailCard] = useState<HomeCard | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(initialScrollTop == null);
  const restoreScrollRef = useRef<number | null>(initialScrollTop ?? null);
  const tail = entries[entries.length - 1];
  const followToken = [
    entries.length,
    tail?.turnId ?? "",
    tail?.userText ?? "",
    tail?.assistantText ?? "",
    tail?.playCards.length ?? 0,
    tail?.foodCards.length ?? 0,
    tail?.loading ? 1 : 0,
    tail?.foodLoading ? 1 : 0,
    tail?.blockedMessage ?? "",
    tail?.foodBlocked ? 1 : 0,
    tail?.foodUnavailableMessage ?? "",
    tail?.playRefreshNote ?? "",
    refreshing ? 1 : 0,
  ].join("|");

  const currentPlayKey = entries
    .filter((entry) => entry.current)
    .map((entry) => entry.playCards.map((card) => card.id).join("|"))
    .join("~");
  const previousPlayKey = useRef<string | null>(null);
  useEffect(() => {
    if (previousPlayKey.current == null) {
      previousPlayKey.current = currentPlayKey;
      return;
    }
    if (previousPlayKey.current === currentPlayKey) return;
    previousPlayKey.current = currentPlayKey;
    const currentEntry = entries.find((entry) => entry.current);
    if (!currentEntry) return;
    setSelected((state) => ({ ...state, [turnDeckKey(currentEntry, "play")]: 0 }));
    setDetailCard((card) => {
      if (!card) return null;
      const visible = entries.some(
        (entry) =>
          entry.playCards.some((item) => item.id === card.id) ||
          (entry.foodCards ?? []).some((item) => item.id === card.id)
      );
      return visible ? card : null;
    });
  }, [currentPlayKey, entries]);

  const openedRef = useRef(opened);
  const selectedRef = useRef(selected);
  openedRef.current = opened;
  selectedRef.current = selected;

  const publish = (scrollTop: number) => {
    if (!transcriptRef) return;
    transcriptRef.current = { scrollTop, opened: openedRef.current, selected: selectedRef.current };
  };

  useEffect(() => {
    publish(scrollerRef.current?.scrollTop ?? transcriptRef?.current?.scrollTop ?? 0);
  }, [opened, selected, transcriptRef]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const onScroll = () => {
      const line = element.querySelector(".hama-turn-current .hama-user-line");
      const frame = element.getBoundingClientRect();
      const lineVisible = line instanceof HTMLElement
        ? line.getBoundingClientRect().bottom > frame.top + 8 && line.getBoundingClientRect().top < frame.bottom - 8
        : false;
      const nearBottom = distanceFromBottom(element) <= PIN_THRESHOLD;
      followingRef.current = nearBottom || lineVisible;
      publish(element.scrollTop);
      setShowJump(!nearBottom && !lineVisible && element.scrollHeight > element.clientHeight + 8);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [opened, transcriptRef]);

  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    if (restoreScrollRef.current != null) {
      if (entries.length === 0) return;
      const target = restoreScrollRef.current;
      const max = element.scrollHeight - element.clientHeight;
      if (target > 24 && max + 24 < target) return;
      element.scrollTop = target;
      const nearBottom = distanceFromBottom(element) <= PIN_THRESHOLD;
      followingRef.current = nearBottom;
      restoreScrollRef.current = null;
      publish(element.scrollTop);
      setShowJump(element.scrollHeight > element.clientHeight + 8 && !nearBottom);
      return;
    }
    if (!followingRef.current) {
      const line = element.querySelector(".hama-turn-current .hama-user-line");
      const frame = element.getBoundingClientRect();
      const lineVisible = line instanceof HTMLElement
        ? line.getBoundingClientRect().bottom > frame.top + 8 && line.getBoundingClientRect().top < frame.bottom - 8
        : false;
      setShowJump(!lineVisible && distanceFromBottom(element) > PIN_THRESHOLD && element.scrollHeight > element.clientHeight + 8);
      return;
    }
    element.scrollTop = element.scrollHeight;
    publish(element.scrollTop);
  }, [followToken, opened, transcriptRef]);

  return (
    <div className="hama-conversation-frame">
      <style>{`
        .hama-conversation-frame {
          position: relative;
          flex: 1;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .hama-conversation-scroll {
          flex: 1;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          overflow-anchor: none;
        }
        .hama-conversation-thread {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 18px;
          padding: 12px 0 var(--hama-composer-space, calc(168px + env(safe-area-inset-bottom, 0px)));
          box-sizing: border-box;
        }
        .hama-jump-latest {
          position: static;
          align-self: center;
          flex: 0 0 auto;
          z-index: 2;
          margin: 8px 0 4px;
          border: 1px solid ${LINE};
          background: #fff;
          color: ${GREEN};
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(25, 88, 74, 0.08);
        }
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
      {showJump ? (
        <button
          type="button"
          className="hama-jump-latest"
          data-hama-jump-latest=""
          onClick={() => {
            followingRef.current = true;
            const element = scrollerRef.current;
            if (!element) return;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            element.scrollTo({ top: element.scrollHeight, behavior: reduce ? "auto" : "smooth" });
          }}
        >
          최신 대화
        </button>
      ) : null}
      <div ref={scrollerRef} className="hama-conversation-scroll" data-hama-conversation-scroll="">
      <div className="hama-conversation-thread">
      {entries.map((entry, index) => {
        const expanded = entry.current || opened[entry.userText] !== false;
        const playCount = entry.playCards.length;
        return (
          <section
            key={`${entry.turnId ?? entry.userText}-${index}`}
            className={entry.current && !quiet ? "hama-turn-current" : undefined}
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
            {!entry.blockedMessage && !entry.loading && playCount === 0 && entry.playRefreshNote ? (
              <p data-hama-refresh-empty="" style={{ margin: 0, color: GREEN, fontSize: 14, lineHeight: 1.5 }}>
                {entry.playRefreshNote}
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
                <HamaSwipeDeck
                  kind="play"
                  cards={entry.playCards}
                  index={selected[turnDeckKey(entry, "play")] ?? 0}
                  onIndex={(next) => setSelected((current) => ({ ...current, [turnDeckKey(entry, "play")]: next }))}
                  onOpen={setDetailCard}
                  onReject={entry.current ? onReject : undefined}
                  onRefresh={entry.current ? onRefresh : undefined}
                  refreshing={entry.current && refreshing}
                />
              </div>
            ) : null}
            {entry.showFood ? (
              <section aria-label="식사 추천" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 style={{ margin: 0, color: GREEN, fontSize: 15, fontWeight: 700 }}>식사</h2>
                {entry.anchorName ? (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.45 }}>
                    {entry.provisional ? `임시 기준은 ${entry.anchorName}예요. ` : `거리 기준은 ${entry.anchorName}예요. `}
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
                  <div className={entry.animateFood ? "hama-result-enter" : undefined}>
                    <HamaSwipeDeck
                      kind="food"
                      cards={entry.foodCards}
                      index={selected[turnDeckKey(entry, "food")] ?? 0}
                      onIndex={(next) => setSelected((current) => ({ ...current, [turnDeckKey(entry, "food")]: next }))}
                      onOpen={setDetailCard}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}
          </section>
        );
      })}
      </div>
      </div>
      {detailCard ? <HamaPlaceDetailPanel card={detailCard} onClose={() => setDetailCard(null)} /> : null}
    </div>
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
