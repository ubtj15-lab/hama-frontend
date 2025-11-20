"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ---- Web Speech API 타입 선언 (빌드 에러 방지) ----
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any | null>(null);

  // 🔹 햄버거 메뉴 열림 상태
  const [menuOpen, setMenuOpen] = useState(false);

  // 🔹 메뉴 위치 (삼선 버튼 기준)
  const [menuPos, setMenuPos] = useState({ top: 60, left: 10 });

  // 🔹 삼선 버튼 ref
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // ======================
  // 🔊 음성 인식 초기 세팅
  // ======================
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("이 브라우저는 음성 인식을 지원하지 않아요 ㅠㅠ");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      setQuery(transcript);
      handleSearch(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔍 검색 실행
  const handleSearch = (text?: string) => {
    const keyword = (text ?? query).trim();
    if (!keyword) return;
    router.push(`/search?query=${encodeURIComponent(keyword)}`);
  };

  // ======================
  // 🔥 메뉴 버튼 위치 → 메뉴 카드 위치 계산
  // ======================
  const updateMenuPosition = () => {
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();

    setMenuPos({
      top: rect.bottom + 8, // 버튼 바로 아래 8px
      left: rect.left, // 버튼과 같은 X 좌표
    });
  };

  // 메뉴 열릴 때 위치 계산
  useEffect(() => {
    if (menuOpen) {
      updateMenuPosition();
    }
  }, [menuOpen]);

  // 리사이즈 시에도 위치 보정
  useEffect(() => {
    const handler = () => {
      if (menuOpen) updateMenuPosition();
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [menuOpen]);

  // 🎙 마이크 클릭
  const handleMicClick = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요 ㅠㅠ (크롬 권장)");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch {
        // 이미 실행 중일 때 start() 호출 에러 방지
      }
    }
  };

  // 🍔 메뉴 버튼 클릭
  const handleMenuClick = () => {
    setMenuOpen((prev) => !prev);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e9f2fb",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          padding: "24px 16px 40px",
          boxSizing: "border-box",
          position: "relative",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        {/* ===================== 메뉴 오버레이 ===================== */}
        {menuOpen && (
          <>
            {/* 바깥 클릭 시 닫힘 영역 */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1500,
              }}
            />

            {/* 메뉴 카드 (삼선 버튼 기준 위치) */}
            <div
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: 200,
                borderRadius: 20,
                background: "#ffffff",
                boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
                padding: "10px 12px",
                zIndex: 2000,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>하마 메뉴</div>

              {/* 🔥 오늘의 추천 보기 버튼 */}
              <button
                type="button"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                  marginBottom: 8,
                  fontWeight: 600,
                }}
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/recommend");
                }}
              >
                오늘의 추천 보기
              </button>

              <button
                type="button"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#f3f4f6",
                  cursor: "pointer",
                  marginBottom: 6,
                }}
                onClick={() => {
                  alert("내 예약 보기 기능은 베타에서 준비 중이에요 🙂");
                  setMenuOpen(false);
                }}
              >
                내 예약 (준비중)
              </button>

              <button
                type="button"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#f3f4f6",
                  cursor: "pointer",
                  marginBottom: 6,
                }}
                onClick={() => {
                  alert("최근 본 매장은 다음 버전에서 열릴 예정이에요!");
                  setMenuOpen(false);
                }}
              >
                최근 본 매장
              </button>

              <button
                type="button"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#f3f4f6",
                  cursor: "pointer",
                }}
                onClick={() => {
                  alert("설정 화면도 곧 붙일 거예요 🔧");
                  setMenuOpen(false);
                }}
              >
                설정 (준비중)
              </button>
            </div>
          </>
        )}

        {/* ===================== 상단 검색바 + 메뉴 ===================== */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
          }}
        >
          {/* 햄버거 버튼 */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleMenuClick}
            aria-label="메뉴 열기"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "none",
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 2,
                borderRadius: 999,
                background: "#111827",
                boxShadow: "0 6px 0 #111827, 0 -6px 0 #111827",
              }}
            />
          </button>

          {/* 검색 인풋 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: 999,
              padding: "0 6px 0 20px",
              boxShadow: "0 8px 18px rgba(15,23,42,0.14)",
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장소를 말하거나 입력하세요 (예: 카페 찾아줘)"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                height: 44,
                fontSize: 14,
                background: "transparent",
              }}
            />
            <button
              type="button"
              onClick={() => handleSearch()}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "0 18px",
                height: 36,
                marginRight: 4,
                background:
                  "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 14px rgba(37,99,235,0.45)",
              }}
            >
              검색
            </button>
          </div>
        </header>

        {/* ===================== 하마 메인 카드 ===================== */}
        <section
          style={{
            background: "#cde7ff",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 12px 24px rgba(15,23,42,0.16)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
            minHeight: 260,
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 30,
              overflow: "hidden",
              background:
                "radial-gradient(circle at top, #ffe082, #ffb74d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Image
              src="/images/hama.png" // public/images/hama.png 필요
              alt="하마"
              fill
              sizes="220px"
              style={{
                objectFit: "contain",
                padding: 20,
              }}
            />
          </div>
        </section>

        {/* ===================== 마이크 버튼 ===================== */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={handleMicClick}
            aria-label="음성 검색 시작"
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              border: "none",
              background: isListening ? "#1d4ed8" : "#ffffff",
              boxShadow: "0 14px 26px rgba(15,23,42,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.2s ease, transform 0.1s ease",
              transform: isListening ? "scale(1.04)" : "scale(1)",
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: isListening ? "#ffffff" : "#2563eb",
              }}
            >
              🎙
            </span>
          </button>

          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
          </p>
        </section>
      </div>
    </main>
  );
}
