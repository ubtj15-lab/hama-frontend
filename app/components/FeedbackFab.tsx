"use client";

import React, { useState } from "react";

type FeedbackKind = "error" | "idea" | "ux";

type FeedbackFabProps = {
  /** 피드백을 성공적으로 보냈을 때 호출 (포인트 적립용) */
  onFeedbackSubmitted?: (kind: FeedbackKind) => void;
};

export default function FeedbackFab({ onFeedbackSubmitted }: FeedbackFabProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FeedbackKind>("error");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) {
      alert("피드백 내용을 먼저 입력해 주세요 🙂");
      return;
    }

    // 🔹 실제론 백엔드에 전송해야 하지만, 지금은 데모 알림만
    alert("피드백이 접수된 것처럼 동작하는 데모입니다. 고마워요! 💙");

    // 🔹 포인트 적립 콜백 호출
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(tab);
    }

    // 폼 리셋
    setText("");
    setEmail("");
    setTab("error");
    setOpen(false);
  };

  return (
    <>
      {/* 오른쪽 아래 둥둥 떠 있는 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: "425px", // 네가 맞춰둔 위치 그대로
          right: "40vw",
          width: 54,
          height: 54,
          borderRadius: "9999px",
          border: "none",
          background: "#2563eb",
          boxShadow: "0 10px 22px rgba(15,23,42,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2100,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        피드백
      </button>

      {/* 모달 */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 2600,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: 80,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
              padding: "18px 18px 16px",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                하마에게 피드백 보내기
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* 탭 버튼 */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <TabButton
                active={tab === "error"}
                label="오류 신고"
                onClick={() => setTab("error")}
              />
              <TabButton
                active={tab === "idea"}
                label="제안하기"
                onClick={() => setTab("idea")}
              />
              <TabButton
                active={tab === "ux"}
                label="불편한 점"
                onClick={() => setTab("ux")}
              />
            </div>

            {/* 텍스트 입력 */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "어떤 점이 좋았는지 / 불편했는지 / 개선 아이디어를 자유롭게 적어주세요."
              }
              style={{
                width: "100%",
                minHeight: 110,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
                resize: "vertical",
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />

            {/* 이메일 (선택 사항) */}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 (선택사항)"
              style={{
                width: "100%",
                borderRadius: 9999,
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            {/* 전송 버튼 */}
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                width: "100%",
                borderRadius: 9999,
                border: "none",
                padding: "10px 0",
                fontSize: 14,
                fontWeight: 700,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#ffffff",
                cursor: "pointer",
                marginBottom: 6,
              }}
            >
              하마에게 보내기
            </button>

            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              베타 기간 동안 보내주신 피드백은 포인트로 보상할 예정이에요 :)
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type TabButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

function TabButton({ active, label, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "7px 0",
        borderRadius: 9999,
        border: "none",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        background: active ? "#111827" : "#f3f4f6",
        color: active ? "#f9fafb" : "#4b5563",
      }}
    >
      {label}
    </button>
  );
}
