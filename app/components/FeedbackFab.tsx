// app/components/FeedbackFab.tsx
"use client";

import React, { useState } from "react";
import { logEvent } from "@/lib/logEvent";

interface FeedbackFabProps {
  page?: string; // 어디서 열렸는지(옵션)
}

export default function FeedbackFab({ page = "home" }: FeedbackFabProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    logEvent("page_view", { page: "feedback_opened", from: page });
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    setSending(true);
    try {
      // 🔹 피드백 내용을 Supabase log_events에 저장
      await logEvent("custom", {
        kind: "feedback",
        from: page,
        message: text,
      });

      setMessage("");
      setOpen(false);
      alert("피드백이 전송되었어요. 고마워! 🙌");
    } catch (err) {
      console.error("피드백 전송 실패:", err);
      alert("피드백 전송 중 오류가 났어요. 나중에 다시 시도해줘 ㅠㅠ");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 오른쪽 아래 둥둥 떠 있는 버튼 */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          background:
            "linear-gradient(135deg, rgba(37,99,235,1), rgba(59,130,246,1))",
          boxShadow: "0 12px 24px rgba(15,23,42,0.3)",
          color: "#fff",
          fontSize: 24,
          cursor: "pointer",
          zIndex: 2000,
        }}
        aria-label="하마에게 피드백 보내기"
      >
        💬
      </button>

      {/* 모달 */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
          }}
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 18,
              background: "#ffffff",
              padding: 20,
              boxShadow:
                "0 18px 40px rgba(15,23,42,0.35), 0 0 0 1px rgba(148,163,184,0.4)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              하마에게 피드백 보내기
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginBottom: 12,
              }}
            >
              불편했던 점이나 있었으면 하는 기능을 자유롭게 적어줘.
            </p>

            <form onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="예: 검색 결과에 키즈카페도 같이 나오면 좋겠어요!"
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 10,
                  fontSize: 13,
                  resize: "none",
                  boxSizing: "border-box",
                  marginBottom: 12,
                  outline: "none",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #2563eb, #4f46e5)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? "보내는 중..." : "보내기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
