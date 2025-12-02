"use client";

import React, { useState } from "react";
import { logEvent } from "@/lib/logEvent";

type FeedbackFabProps = {
  page?: string;
};

export default function FeedbackFab({ page = "home" }: FeedbackFabProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"bug" | "improve" | "praise">("bug");
  const [sending, setSending] = useState(false);

  const currentPage = page ?? "home";

  // 피드백 버튼 클릭
  const handleOpen = () => {
    setOpen(true);
    logEvent("custom", {
      kind: "feedback_open",
      page: currentPage,
    });
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      await logEvent("feedback", {
        page: currentPage,
        category,
        message,
      });
      setMessage("");
      setOpen(false);
      // alert("피드백이 전송되었어요. 고마워요! 🙌");
    } catch (err) {
      console.error("피드백 전송 오류:", err);
      alert("전송 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 🔵 우측 하단 파란 동그라미 버튼 */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 2000,
          width: 64,
          height: 64,
          borderRadius: 999,
          border: "none",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 700,
          boxShadow: "0 12px 25px rgba(37, 99, 235, 0.55)",
          cursor: "pointer",
        }}
      >
        피드백
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,23,42,0.45)",
            padding: 16,
          }}
        >
          {/* 모달 카드 */}
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              borderRadius: 20,
              background: "#ffffff",
              padding: 20,
              boxShadow:
                "0 18px 40px rgba(15,23,42,0.35), 0 0 0 1px rgba(148,163,184,0.35)",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  하마에게 피드백 보내기
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  버그 / 개선점 / 칭찬 뭐든 편하게 적어줘 😊
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="닫기"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
              >
                ✕
              </button>
            </div>

            {/* 카테고리 선택 */}
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as "bug" | "improve" | "praise")
                }
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "8px 10px",
                  fontSize: 13,
                  background: "#f9fafb",
                }}
              >
                <option value="bug">🐞 버그 / 오류 신고</option>
                <option value="improve">✨ 개선 제안</option>
                <option value="praise">💙 칭찬 / 좋은 점</option>
              </select>
            </div>

            {/* 텍스트 입력 */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`예) 검색 결과에 우리 동네 카페가 안 보여요.\n예) 예약 버튼 위치가 조금 헷갈려요.`}
              style={{
                width: "100%",
                height: 110,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                padding: "10px 12px",
                fontSize: 13,
                resize: "none",
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            {/* 버튼 영역 */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                disabled={sending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={sending}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: sending
                    ? "rgba(37,99,235,0.5)"
                    : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: sending ? "default" : "pointer",
                }}
              >
                {sending ? "보내는 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
