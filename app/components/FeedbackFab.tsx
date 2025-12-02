"use client";

import React, { useState } from "react";
import { logEvent } from "../lib/logEvent";

export default function FeedbackFab({ page = "home" }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [sending, setSending] = useState(false);

  const currentPage = page ?? "home";

  // ◆ 피드백창 열기
  const handleOpen = () => {
    setOpen(true);

    logEvent("custom", {
      kind: "feedback_open",
      page: currentPage,
    });
  };

  // ◆ 닫기
  const handleClose = () => {
    setOpen(false);
  };

  // ◆ 피드백 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) return;
    setSending(true);

    await logEvent("feedback", {
      page: currentPage,
      category,
      message,
    });

    setSending(false);
    setMessage("");
    setOpen(false);
  };

  return (
    <>
      {/* 🔵 파란색 플로팅 버튼 */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-blue-600 px-5 py-3 text-white font-semibold shadow-xl hover:bg-blue-700 active:scale-95 transition"
      >
        피드백
      </button>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">하마에게 피드백 보내기</h2>
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              버그 / 개선점 / 칭찬 뭐든 편하게 적어줘 😊
            </p>

            {/* 카테고리 선택 */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mb-3 rounded-xl border p-2 text-sm"
            >
              <option value="bug">🐞 버그 / 오류 신고</option>
              <option value="improve">✨ 개선 제안</option>
              <option value="praise">💙 칭찬 / 좋은 점</option>
            </select>

            {/* 메시지 입력 */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-28 border rounded-xl p-3 text-sm resize-none"
              placeholder={`예) 검색 결과에 우리 동네 카페가 안 보여요!\n예) 예약 버튼 위치가 조금 헷갈려요.`}
            />

            {/* 하단 버튼들 */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                취소
              </button>

              <button
                onClick={handleSubmit}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {sending ? "전송 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
