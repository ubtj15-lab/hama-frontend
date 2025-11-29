"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 🔹 피드백 FAB
import FeedbackFab from "@/components/FeedbackFab";

// ---- Web Speech API 타입 선언 (빌드 에러 방지) ----
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

// ======================
// 🗂 카테고리 매핑 & 인식
// ======================
const CATEGORY_MAP: Record<string, string> = {
  카페: "CE7",
  커피: "CE7",
  식당: "FD6",
  음식점: "FD6",
  밥집: "FD6",
  미용실: "BK9",
  헤어: "BK9",
  이발소: "BK9",
  편의점: "CS2",
  약국: "PM9",
  병원: "HP8",
  주차장: "PK6",
  마트: "MT1",
};

function inferCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (lower.includes(key)) {
      return CATEGORY_MAP[key];
    }
  }
  return null;
}

// ======================
// 🧩 포인트 / 로그 저장 구조
// ======================
interface HamaUser {
  nickname: string;
  points: number;
}

interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

const USER_KEY = "hamaUser";
const LOG_KEY = "hamaPointLogs";
const LOGIN_FLAG_KEY = "hamaLoggedIn"; // 🔐 로그인 여부 플래그

function loadUserFromStorage(): HamaUser {
  if (typeof window === "undefined") {
    return { nickname: "게스트", points: 0 };
  }
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { nickname: "게스트", points: 0 };
    const parsed = JSON.parse(raw);
    return {
      nickname: parsed.nickname ?? "게스트",
      points: typeof parsed.points === "number" ? parsed.points : 0,
    };
  } catch {
    return { nickname: "게스트", points: 0 };
  }
}

function saveUserToStorage(user: HamaUser) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

function appendPointLog(amount: number, reason: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const prev: PointLog[] = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const log: PointLog = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
      amount,
      reason,
      createdAt: now.toISOString(),
    };
    const next = [log, ...prev].slice(0, 100);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  // 🔹 메뉴 관련
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 60, left: 10 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // 🔹 유저 (닉네임 + 포인트)
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });

  // 🔹 로그인 여부를 따로 관리 (닉네임 말고 플래그 기준)
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ======================
  // 🧩 초기 유저 정보 + 로그인 플래그 로드
  // ======================
  useEffect(() => {
    const syncLoginState = () => {
      if (typeof window === "undefined") return;

      const loaded = loadUserFromStorage();
      setUser(loaded);

      const flag = window.localStorage.getItem(LOGIN_FLAG_KEY);
      setIsLoggedIn(flag === "1");
    };

    // 처음 로드 시
    syncLoginState();

    // 뒤로가기(bfcache), 포커스, 다른 탭 변경까지
    window.addEventListener("pageshow", syncLoginState);
    window.addEventListener("focus", syncLoginState);
    window.addEventListener("storage", syncLoginState);

    return () => {
      window.removeEventListener("pageshow", syncLoginState);
      window.removeEventListener("focus", syncLoginState);
      window.removeEventListener("storage", syncLoginState);
    };
  }, []);

  // ======================
  // 💰 포인트 적립 함수
  // ======================
  const addPoints = (amount: number, reason: string) => {
    setUser((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveUserToStorage(updated);
      appendPointLog(amount, reason);
      console.log("포인트 적립:", amount, reason);
      return updated;
    });
  };

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
      handleSearch(transcript); // 음성 결과로 바로 검색
      addPoints(10, "음성 검색");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔍 검색 실행 (텍스트/음성 공통)
  const handleSearch = (text?: string) => {
    const keyword = (text ?? query).trim();
    if (!keyword) return;

    const detectedCategory = inferCategory(keyword);

    if (detectedCategory) {
      addPoints(5, "카테고리 검색");
      router.push(`/search?category=${detectedCategory}`);
      return;
    }

    addPoints(5, "검색");
    router.push(`/search?query=${encodeURIComponent(keyword)}`);
  };

  // ⌨️ 엔터(이동) 누를 때도 검색 실행
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  };

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
        // 이미 실행 중일 때 start 에러 방지
      }
    }
  };

  // 🍔 메뉴 버튼 클릭
  const handleMenuClick = () => {
    setMenuOpen((prev) => !prev);
  };

  // 메뉴 위치 업데이트
  const updateMenuPosition = () => {
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();

    setMenuPos({
      top: rect.bottom + 8,
      left: rect.left,
    });
  };

  useEffect(() => {
    if (menuOpen) {
      updateMenuPosition();
    }
  }, [menuOpen]);

  useEffect(() => {
    const handler = () => {
      if (menuOpen) updateMenuPosition();
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [menuOpen]);

  // ============================
  // 🟡 카카오 로그인 / 로그아웃 버튼
  // ============================
  const handleKakaoButtonClick = () => {
    if (isLoggedIn) {
      // 🔴 로그아웃: 브라우저 쪽 정보 다 정리
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(LOG_KEY);
        window.localStorage.removeItem(LOGIN_FLAG_KEY);
      }
      setUser({ nickname: "게스트", points: 0 });
      setIsLoggedIn(false);

      // 서버 로그아웃 라우트로 이동 (Next API)
      window.location.href = "/api/auth/kakao/logout";
    } else {
      // 🟢 로그인: 앱 기준으로는 로그인 상태로 표시
      if (typeof window !== "undefined") {
        const newUser: HamaUser = {
          nickname: "카카오 사용자", // 나중에 카카오 닉네임으로 교체 가능
          points: user.points,
        };
        window.localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
        setUser(newUser);
        setIsLoggedIn(true);
      }

      // 카카오 로그인 (Next API)
      window.location.href = "/api/auth/kakao/login";
    }
  };

  const goToPointHistory = () => {
    setMenuOpen(false);
    router.push("/mypage/points");
  };

  const goToRecentStores = () => {
    alert("최근 본 매장은 다음 버전에서 열릴 예정이에요!");
    setMenuOpen(false);
  };

  const goToMyReservations = () => {
    alert("내 예약 보기 기능은 베타에서 준비 중이에요 🙂");
    setMenuOpen(false);
  };

  const goToSettings = () => {
    alert("설정 화면도 곧 붙일 거예요 🔧");
    setMenuOpen(false);
  };

  // 🆕 베타 안내 페이지 이동
  const goToBetaInfo = () => {
    setMenuOpen(false);
    router.push("/beta-info");
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
            {/* 바깥 클릭 시 닫힘 */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1500,
              }}
            />

            {/* 메뉴 카드 */}
            <div
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: 240,
                borderRadius: 20,
                background: "#ffffff",
                boxShadow:
                  "0 10px 25px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.3)",
                padding: 16,
                zIndex: 1600,
                fontSize: 13,
              }}
            >
              {/* 프로필/포인트 영역 */}
              <div
                style={{
                  marginBottom: 16,
                  paddingBottom: 10,
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#6B7280",
                    marginBottom: 4,
                  }}
                >
                  안녕하세요 👋
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: 6,
                  }}
                >
                  {user.nickname || "게스트"} 님
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#EEF2FF",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#4F46E5",
                      fontWeight: 600,
                    }}
                  >
                    포인트
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {user.points.toLocaleString()} P
                  </span>
                </div>
              </div>

              {/* 카카오 로그인 / 메뉴 버튼들 */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {/* 🔐 로그인 / 로그아웃 토글 버튼 */}
                <button
                  onClick={handleKakaoButtonClick}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "none",
                    background: "#FEE500",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2D2D2D",
                    cursor: "pointer",
                  }}
                >
                  {isLoggedIn ? "로그아웃" : "카카오로 로그인"}
                </button>

                <button
                  onClick={goToPointHistory}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#ffffff",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  📌 포인트 히스토리
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/recommend");
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "none",
                    background: "#2563EB",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  오늘의 추천 보기
                </button>

                {/* 🆕 베타 안내 버튼 */}
                <button
                  onClick={goToBetaInfo}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#EEF2FF",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  🦛 베타 안내 보기
                </button>

                <button
                  onClick={goToMyReservations}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#f3f4f6",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  내 예약 (준비중)
                </button>

                <button
                  onClick={goToRecentStores}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#f3f4f6",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  최근 본 매장
                </button>

                <button
                  onClick={goToSettings}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#f3f4f6",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  설정 (준비중)
                </button>
              </div>
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

          {/* 검색 인풋 (Enter / 이동 키로도 검색) */}
          <form
            onSubmit={handleSearchSubmit}
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
              type="submit"
              style={{
                border: "none",
                borderRadius: 999,
                padding: "0 18px",
                height: 36,
                marginRight: 4,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 14px rgba(37,99,235,0.45)",
              }}
            >
              검색
            </button>
          </form>
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
              background: "radial-gradient(circle at top, #ffe082, #ffb74d)",
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
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "none",
              background: isListening ? "#1d4ed8" : "#ffffff",
              boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.2s ease, transform 0.1s ease",
              transform: isListening ? "scale(1.04)" : "scale(1)",
              marginBottom: 110, // 피드백 버튼과 간격
            }}
          >
            <span
              style={{
                fontSize: 24,
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

        {/* 🔹 우측 하단 피드백 버튼 */}
        <FeedbackFab />
      </div>
    </main>
  );
}
