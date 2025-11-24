"use client";

import React, { useState } from "react";

type FeedbackType = "bug" | "idea" | "etc";

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  createdAt: string;
}

const STORAGE_KEY = "hamaFeedbacks";

/** 로컬스토리지에 피드백 저장 */
function saveFeedbackToStorage(item: FeedbackItem) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prev: FeedbackItem[] = raw ? JSON.parse(raw) : [];
    const next = [item, ...prev].slice(0, 100); // 최근 100개만 보관
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 실패해도 서비스 흐름 끊기지 않게 무시
  }
}

export default function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      alert("간단하게라도 내용을 입력해 주세요 🙂");
      return;
    }

    setSubmitting(true);
    const now = new Date();

    const item: FeedbackItem = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      message: trimmed,
      createdAt: now.toISOString(),
    };

    // 지금은 로컬스토리지 + console.log 로만 저장
    saveFeedbackToStorage(item);
    console.log("하마 피드백:", item);

    setSubmitting(false);
    setMessage("");
    setType("bug");
    setOpen(false);
    alert("피드백이 저장되었어요! 하마가 잘 참고할게요 🦛✨");
  };

  return (
    <>
      {/* 오버레이 (배경 클릭하면 닫힘) */}
      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 2100,
          }}
        />
      )}

      {/* 우측 하단 플로팅 버튼 */}
      <button
        type="button"
        onClick={() => !submitting && setOpen((prev) => !prev)}
        aria-label="피드백 보내기"
        style={{
          position: "fixed",
          right: 20,
          bottom: 26, // 마이크 버튼과 겹치지 않게 여백
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          boxShadow: "0 10px 24px rgba(15,23,42,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2200,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            textAlign: "center",
            whiteSpace: "pre-line",
          }}
        >
          피드백
        </span>
      </button>

      {/* 피드백 입력 카드 */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 104, // 버튼 바로 위에 뜨도록
            width: 280,
            borderRadius: 18,
            background: "#ffffff",
            boxShadow:
              "0 18px 40px rgba(15,23,42,0.35), 0 0 0 1px rgba(148,163,184,0.35)",
            padding: "14px 14px 12px",
            zIndex: 2300,
            fontFamily: "Noto Sans KR, system-ui, sans-serif",
            fontSize: 13,
          }}
        >
          <div
            style={{
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                하마에게 피드백 보내기
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginTop: 2,
                }}
              >
                버그 / 개선점 / 칭찬 뭐든 편하게 적어줘 🙂
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 16,
                cursor: "pointer",
                color: "#9ca3af",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* 타입 선택 */}
          <div style={{ marginBottom: 8 }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              disabled={submitting}
              style={{
                width: "100%",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                padding: "6px 10px",
                fontSize: 12,
                background: "#f9fafb",
                outline: "none",
              }}
            >
              <option value="bug">🐞 버그 / 오류 신고</option>
              <option value="idea">💡 기능 / UX 개선 제안</option>
              <option value="etc">💬 칭찬 / 기타 의견</option>
            </select>
          </div>

          {/* 내용 입력 */}
          <div style={{ marginBottom: 10 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예) 검색 결과에 우리 동네 카페가 안 보여요!&#10;예) 예약 버튼 위치가 조금 헷갈려요."
              rows={4}
              disabled={submitting}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "8px 10px",
                fontSize: 12,
                resize: "none",
                outline: "none",
              }}
            />
          </div>

          {/* 버튼들 */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => !submitting && setOpen(false)}
              disabled={submitting}
              style={{
                border: "none",
                background: "transparent",
                padding: "6px 8px",
                fontSize: 12,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              취소
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                background: submitting
                  ? "rgba(37,99,235,0.4)"
                  : "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#ffffff",
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "보내는 중..." : "보내기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
