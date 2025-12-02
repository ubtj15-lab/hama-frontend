// app/components/FeedbackFab.tsx
"use client";

import React, { useState } from "react";
import { logEvent } from "../lib/logEvent";

interface FeedbackFabProps {
  page?: string;
}

export default function FeedbackFab({ page = "home" }: FeedbackFabProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // 🔹 피드백 창 열기
  const handleOpen = () => {
    setOpen(true);
  };

  // 🔹 피드백 창 닫기
  const handleClose = () => {
    setOpen(false);
  };

  // 🔹 피드백 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    setSending(true);

    try {
      // 🟦 Supabase log_events에 저장되는 기록
      await logEvent("feedback", {
        page,
        message: text,
      });
    } catch (err) {
      console.error("피드백 저장 실패:", err);
    }

    setMessage("");
    setOpen(false);
    setSending(false);

    alert("피드백이 전송되었어요. 고마워! 🙌");
  };

  return (
    <>
      {/* 🔵 우측 하단 floating button */}
      <button
        onClick={handleOpen}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#2563EB",
          color: "white",
          border: "none",
          fontSize: 24,
          boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
          cursor: "pointer",
          zIndex: 2000,
        }}
      >
        💬
      </button>

      {/* 🔵 피드백 모달 */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: 350,
              background: "white",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h3 style={{ marginBottom: 12 }}>피드백 보내기</h3>

            <form onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="하마에게 남기고 싶은 의견을 적어주세요!"
                style={{
                  width: "100%",
                  height: 100,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  marginBottom: 12,
                  fontSize: 14,
                }}
              />

              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%",
                  background: "#2563EB",
                  color: "white",
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                {sending ? "전송 중..." : "전송하기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
