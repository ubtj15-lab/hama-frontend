"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { HomeCard } from "@/lib/storeTypes";
import { openDirections } from "@/lib/openDirections";
import { storePhoto } from "./HamaSwipeDeck";

const GREEN = "#19584A";
const MUTED = "#7E948C";
const LINE = "#D5E3DC";
const IVORY = "#FBFCF9";

type Props = {
  card: HomeCard;
  onClose: () => void;
};

function categoryText(card: HomeCard): string {
  const label = String(card.categoryLabel ?? "").trim();
  return /[가-힣]/.test(label) ? label : "";
}

function reasonText(card: HomeCard): string {
  return String(card.reasonText ?? "").trim();
}

function distanceText(card: HomeCard): string | null {
  if (typeof card.distanceKm !== "number" || !Number.isFinite(card.distanceKm)) return null;
  return `직선거리 ${card.distanceKm.toFixed(1)}km`;
}

function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? "곳";
}

export function HamaPlaceDetailPanel({ card, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroller = document.querySelector<HTMLElement>("[data-hama-conversation-scroll]");
    const previousScrollerOverflow = scroller?.style.overflow ?? "";
    const previousBodyOverflow = document.body.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")].filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (scroller) scroller.style.overflow = previousScrollerOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, []);

  const photo = storePhoto(card);
  const category = categoryText(card);
  const reason = reasonText(card);
  const distance = distanceText(card);
  const address = String(card.address ?? "").trim();
  const phone = String(card.phone ?? "").trim();
  const description = String(card.description ?? "").trim();
  const meta = [category, distance].filter(Boolean).join(" · ");

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(25, 40, 36, 0.28)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hama-place-panel-title"
        data-hama-place-panel=""
        data-hama-panel-place={card.id}
        style={{
          width: "min(430px, 100%)",
          maxHeight: "min(92vh, 820px)",
          overflow: "auto",
          background: IVORY,
          color: GREEN,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -12px 40px rgba(25, 88, 74, 0.16)",
        }}
      >
        <div style={{ position: "relative", aspectRatio: "4 / 3", background: "#E7F0EB" }}>
          {photo ? (
            <img src={photo} alt="" data-hama-panel-photo="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div
              data-hama-panel-fallback=""
              style={{
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                padding: 22,
                boxSizing: "border-box",
                background:
                  "radial-gradient(120% 80% at 100% 0%, rgba(25, 88, 74, 0.16), transparent 55%), linear-gradient(165deg, #F7F3EA 0%, #E4EFE8 100%)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif",
                  fontSize: 84,
                  lineHeight: 0.8,
                  fontWeight: 600,
                }}
              >
                {initialOf(card.name)}
              </p>
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              border: "none",
              background: IVORY,
              color: GREEN,
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ padding: "18px 18px 28px" }}>
          <h2 id="hama-place-panel-title" style={{ margin: 0, fontSize: 26, lineHeight: 1.25, letterSpacing: "-0.04em" }}>
            {card.name}
          </h2>
          {meta ? <p style={{ margin: "8px 0 0", color: MUTED, fontSize: 13 }}>{meta}</p> : null}
          {reason ? <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55 }}>{reason}</p> : null}
          {address ? <p style={{ margin: "14px 0 0", fontSize: 14, lineHeight: 1.5 }}>{address}</p> : null}
          {description ? <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55 }}>{description}</p> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => openDirections({ name: card.name, lat: card.lat, lng: card.lng })}
              style={actionButton}
            >
              길찾기
            </button>
            {phone ? (
              <a href={`tel:${phone}`} style={{ ...actionButton, textDecoration: "none" }}>
                전화하기
              </a>
            ) : null}
          </div>
        </div>
      </section>
      <style>{`
        @media (min-width: 768px) {
          [data-hama-place-panel] {
            align-self: center;
            border-radius: 24px;
            margin-bottom: 24px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hama-place-panel] { scroll-behavior: auto; }
        }
      `}</style>
    </div>,
    document.body
  );
}

const actionButton: React.CSSProperties = {
  border: `1px solid ${LINE}`,
  background: "#fff",
  color: GREEN,
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
