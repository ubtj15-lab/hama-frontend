"use client";

import React, { useEffect, useRef, useState } from "react";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";

const IVORY = "#FBFCF9";
const GREEN = "#19584A";
const MUTED = "#7E948C";
const LOOP_MS = 18000;

const SCENES = [
  {
    title: "조용히 이야기할 수 있는 카페",
    subtitle: "분위기와 혼잡도를 함께 살펴봐요",
  },
  {
    title: "출근길, 지금 문 연 카페",
    subtitle: "픽업하고 바로 출발할 수 있어요",
  },
  {
    title: "비 오는 날, 아이들과 갈 곳",
    subtitle: "가까운 실내 장소를 찾고 있어요",
  },
] as const;

function QuietCafeScene() {
  return (
    <svg viewBox="0 0 220 140" width="300" height="191" aria-hidden>
      <circle cx="110" cy="62" r="58" fill="#E7F0EB" />
      <circle cx="110" cy="62" r="40" fill="#F4F8F6" />
      <g fill={GREEN} opacity="0.45" fontSize="11">
        <text x="86" y="28">♪</text>
        <text x="104" y="22">→</text>
        <text x="124" y="28">♩</text>
      </g>
      <g fill="#E4EFE8" stroke={GREEN} strokeWidth="1.4">
        <rect x="28" y="48" width="46" height="28" rx="14" />
        <rect x="146" y="48" width="46" height="28" rx="14" />
      </g>
      <g fill="none" stroke={GREEN} strokeWidth="1.6">
        <circle cx="51" cy="62" r="6" />
        <circle cx="169" cy="62" r="6" />
      </g>
      <path d="M68 108h84M78 108v-22h12v22M130 108v-22h12v22" fill="none" stroke={GREEN} strokeWidth="4" strokeLinecap="square" />
    </svg>
  );
}

function CommuteScene() {
  return (
    <svg viewBox="0 0 220 140" width="300" height="191" aria-hidden>
      <circle cx="110" cy="70" r="58" fill="#E7F0EB" />
      <text x="110" y="42" textAnchor="middle" fill={MUTED} fontSize="13">오전 7:10</text>
      <path d="M36 92h148" stroke="#D5E3DC" strokeWidth="2" />
      <g fill="none" stroke={GREEN} strokeWidth="1.6">
        <rect x="92" y="78" width="22" height="12" rx="3" />
        <circle cx="98" cy="91" r="2.2" fill={GREEN} />
        <circle cx="108" cy="91" r="2.2" fill={GREEN} />
      </g>
      <g>
        <rect x="150" y="58" width="42" height="32" rx="8" fill="#E4EFE8" />
        <path d="M164 76h8a6 4 0 0 1 0 8h-6z" fill="none" stroke={GREEN} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function RainFamilyScene() {
  return (
    <svg viewBox="0 0 220 150" width="300" height="205" aria-hidden>
      <circle cx="110" cy="62" r="58" fill="#E7F0EB" />
      {[28, 52, 168, 190].map((x, i) => (
        <path key={x} d={`M${x} ${18 + (i % 2) * 8} l6 16`} stroke={GREEN} strokeWidth="1.4" opacity="0.35" />
      ))}
      <g fill={GREEN}>
        <circle cx="86" cy="48" r="8" />
        <rect x="74" y="58" width="24" height="28" rx="8" />
        <circle cx="110" cy="54" r="6" />
        <rect x="101" y="62" width="18" height="22" rx="7" />
        <circle cx="132" cy="58" r="5" />
        <rect x="125" y="64" width="14" height="18" rx="6" />
      </g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={58 + i * 38} y="104" width="30" height="24" rx="8" fill={i === 1 ? "#D5E6DE" : "#E7F0EB"} />
      ))}
    </svg>
  );
}

const DRAWINGS = [QuietCafeScene, CommuteScene, RainFamilyScene];

export function HamaSceneLoop() {
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <style>{`
        @keyframes hamaScene {
          0% { opacity: 0; }
          5% { opacity: 1; }
          33.33% { opacity: 1; }
          38.33% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
      {SCENES.map((scene, index) => {
        const Drawing = DRAWINGS[index]!;
        return (
          <div
            key={scene.title}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              opacity: 0,
              animation: `hamaScene ${LOOP_MS}ms linear infinite`,
              animationDelay: `${index * 6000}ms`,
            }}
          >
            <Drawing />
            <p style={{ margin: "18px 0 0", color: GREEN, fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>{scene.title}</p>
            <p style={{ margin: "8px 0 0", color: MUTED, fontSize: 14 }}>{scene.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
}

type ComposerProps = {
  onSubmit: (text: string) => void;
  onNewConversation: () => void;
  onOpenCalendar: () => void;
};

export function HamaHomeComposer({ onSubmit, onNewConversation, onOpenCalendar }: ComposerProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuNote, setMenuNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript?.trim?.() ?? "";
      if (!text) return;
      setValue("");
      onSubmit(text);
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [onSubmit]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    setValue("");
    onSubmit(text);
  };

  return (
    <>
      {menuOpen ? (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, border: "none", background: "transparent", zIndex: 25 }}
        />
      ) : null}
      {menuOpen ? (
        <div
          role="menu"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 108,
            transform: "translateX(-50%)",
            width: "min(430px, calc(100% - 24px))",
            zIndex: 32,
            background: "#fff",
            border: "1px solid #D5E3DC",
            borderRadius: 16,
            padding: 8,
            boxSizing: "border-box",
          }}
        >
          <MenuButton
            label="새 대화"
            onClick={() => {
              setMenuOpen(false);
              setMenuNote(null);
              onNewConversation();
            }}
          />
          <MenuButton label="지난 대화" onClick={() => setMenuNote("저장된 대화가 없어요.")} />
          <MenuButton label="저장한 장소" onClick={() => setMenuNote("장소 목록은 계정 확인이 끝나기 전에는 열지 않아요.")} />
          <MenuButton
            label="캘린더"
            onClick={() => {
              setMenuOpen(false);
              onOpenCalendar();
            }}
          />
          <MenuButton label="HAMA 커뮤" onClick={() => setMenuNote("HAMA 커뮤는 아직 준비 중이에요.")} />
          <MenuButton
            label="HAMA 기억"
            onClick={() => setMenuNote("온보딩에서 고른 프로필과 장기 기억은 별개예요. 확인해서 남긴 기억은 아직 저장하지 않아요.")}
          />
          {menuNote ? <p style={{ margin: "8px 10px 4px", color: MUTED, fontSize: 13, lineHeight: 1.45 }}>{menuNote}</p> : null}
        </div>
      ) : null}
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 12,
        transform: "translateX(-50%)",
        width: "min(430px, calc(100% - 24px))",
        zIndex: 30,
        background: "#fff",
        borderRadius: 22,
        boxShadow: "0 8px 24px rgba(25, 88, 74, 0.08)",
        padding: "14px 14px 10px",
        boxSizing: "border-box",
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="지금 상황이나 원하는 걸 말해줘"
        aria-label="지금 상황이나 원하는 걸 말해줘"
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          color: GREEN,
          fontSize: 15,
          padding: "0 4px 8px",
        }}
      />
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          aria-label="더보기"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuNote(null);
            setMenuOpen((open) => !open);
          }}
          style={{ border: "none", background: "transparent", color: MUTED, fontSize: 22, cursor: "pointer", padding: "4px 8px" }}
        >
          +
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          aria-label="음성으로 말하기"
          onClick={() => {
            logEvent(HamaEvents.voice_mic_click, { page: "home", source: "home_composer" });
            const rec = recognitionRef.current;
            if (!rec) {
              window.alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
              return;
            }
            try {
              if (listening) rec.stop();
              else rec.start();
            } catch {
              /* ignore */
            }
          }}
          style={{ border: "none", background: "transparent", color: listening ? GREEN : MUTED, cursor: "pointer", padding: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="submit"
          aria-label="보내기"
          disabled={!value.trim()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: GREEN,
            color: "#fff",
            cursor: value.trim() ? "pointer" : "default",
            opacity: value.trim() ? 1 : 0.45,
          }}
        >
          ↑
        </button>
      </div>
    </form>
    </>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        color: GREEN,
        fontSize: 15,
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export const HAMA_HOME_IVORY = IVORY;
export const HAMA_HOME_GREEN = GREEN;
