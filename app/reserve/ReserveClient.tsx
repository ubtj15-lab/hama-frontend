"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { logEvent } from "@/lib/logEvent";

const DATE_OPTIONS = [
  { label: "오늘", value: "오늘" },
  { label: "내일", value: "내일" },
  { label: "모레", value: "모레" },
];

const TIME_OPTIONS = ["11:00", "12:00", "13:00", "14:00", "17:00", "18:00", "19:00", "20:00"];

type Step = 1 | 2 | 3 | 4;

export default function ReserveClient() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || searchParams.get("q") || "";
  const storeId = searchParams.get("storeId") ?? "";
  const naverPlaceId = searchParams.get("naverPlaceId") ?? "";

  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    if (name || storeId) {
      logEvent("reserve_flow_start", { store_id: storeId, name, page: "reserve" });
    }
  }, [name, storeId]);

  const handleOpenNaver = () => {
    logEvent("reserve_naver_click", { store_id: storeId, name, page: "reserve" });
    openNaverPlace({
      name: name || "매장",
      naverPlaceId: naverPlaceId || null,
    });
  };

  const handleConfirm = () => {
    logEvent("reserve_flow_complete", {
      store_id: storeId,
      name,
      date,
      time,
      page: "reserve",
    });
    setStep(4);
  };

  if (!name && !storeId) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 24,
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
          background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        }}
      >
        <div style={{ maxWidth: 400, margin: "0 auto" }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginBottom: 24,
              fontSize: 14,
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← 홈으로
          </Link>
          <div
            style={{
              padding: 24,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            매장 정보가 없어요. 홈에서 카드를 눌러 &quot;예약·자세히&quot;로 들어와 주세요.
          </div>
        </div>
      </main>
    );
  }

  const cardStyle = {
    padding: 20,
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
    marginBottom: 16,
  };

  const buttonStyle = {
    display: "block" as const,
    width: "100%" as const,
    padding: "14px 20px",
    borderRadius: 12,
    border: "none" as const,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer" as const,
    fontFamily: "Noto Sans KR, system-ui, sans-serif",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        paddingBottom: 40,
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
      }}
    >
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <Link
            href="/"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "#fff",
              boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              textDecoration: "none",
            }}
          >
            ← 홈으로
          </Link>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>예약하기</h1>
          <div style={{ width: 70 }} />
        </header>

        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>매장</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{name || "매장"}</div>
        </div>

        {step === 1 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>날짜 선택</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDate(opt.value);
                    setStep(2);
                  }}
                  style={{
                    ...buttonStyle,
                    background: date === opt.value ? "#2563eb" : "#f1f5f9",
                    color: date === opt.value ? "#fff" : "#111827",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <div style={{ ...cardStyle, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>선택한 날짜</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{date}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>시간 선택</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTime(t);
                      setStep(3);
                    }}
                    style={{
                      flex: "1 1 22%",
                      minWidth: 80,
                      padding: "12px",
                      borderRadius: 12,
                      border: "none",
                      background: time === t ? "#2563eb" : "#f1f5f9",
                      color: time === t ? "#fff" : "#111827",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "Noto Sans KR, system-ui, sans-serif",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>예약 확인</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
              <strong>{name}</strong>
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>날짜: {date}</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>시간: {time}</div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              아래 완료 후 네이버 예약 페이지에서 실제 예약을 진행해 주세요.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  ...buttonStyle,
                  background: "#f1f5f9",
                  color: "#111827",
                }}
              >
                시간 다시 선택
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  ...buttonStyle,
                  background: "#2563eb",
                  color: "#fff",
                }}
              >
                완료
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
              예약 흐름을 완료했어요
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              {name} · {date} {time}
            </div>
            <button
              type="button"
              onClick={handleOpenNaver}
              style={{
                ...buttonStyle,
                background: "#03C75A",
                color: "#fff",
                marginBottom: 10,
              }}
            >
              네이버에서 예약하기
            </button>
            <Link
              href="/"
              style={{
                ...buttonStyle,
                background: "#f1f5f9",
                color: "#111827",
                textAlign: "center" as const,
                textDecoration: "none",
              }}
            >
              홈으로 돌아가기
            </Link>
          </div>
        )}

        {step > 1 && step < 4 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            style={{
              marginTop: 8,
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              color: "#64748b",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
            }}
          >
            ← 이전
          </button>
        )}
      </div>
    </main>
  );
}
