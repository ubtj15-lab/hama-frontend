"use client";

import React, { useState } from "react";
import { logEvent } from "../lib/logEvent";

type FeedbackFabProps = {
  page?: string; // 현재 페이지 이름 (home / search 등)
};

export default function FeedbackFab({ page = "home" }: FeedbackFabProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const currentPage = page ?? "home";

  // ◆ 피드백 창 열기
  const handleOpen = () => {
    setOpen(true);

    // 피드백 폼 열렸다는 로그
    logEvent("custom", {
      kind: "feedback_open",
      page: currentPage,
    });
  };

  // ◆ 피드백 창 닫기
  const handleClose = () => {
    setOpen(false);
  };

  // ◆ 피드백 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    setSending(true);

    try {
      // Supabase log_events에 저장되는 기록
      await logEvent("feedback", {
        page: currentPage,
        message: text,
      });

      setMessage("");
      setOpen(false);
      alert("피드백이 전송됐어! 고마워 🙌");
    } catch (err) {
      console.error("피드백 전송 오류:", err);
      alert("전송 중 오류가 났어. 잠시 후 다시 시도해줘!");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 플로팅 버튼(FAB) */}
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-50 rounded-full border bg-white/90 px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
      >
        의견 보내기
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                하마에게 피드백 보내기
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-gray-500"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                className="h-32 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                placeholder="불편했던 점, 좋았던 점, 개선 아이디어를 자유롭게 남겨줘 😊"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border px-3 py-1.5 text-sm"
                  disabled={sending}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  disabled={sending}
                >
                  {sending ? "전송 중..." : "전송하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
