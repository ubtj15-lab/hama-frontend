"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";

export default function FeedbackPage() {
  const router = useRouter();

  const [type, setType] = useState<"bug" | "idea" | "ux" | "etc">("bug");
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert("어떤 점이 좋았는지 / 불편했는지 간단히 적어줘 😊");
      return;
    }

    // 👉 실제 서비스에서는 여기서 서버로 전송할 예정
    console.log("[HAMA FEEDBACK]", {
      type,
      text,
      contact,
      createdAt: new Date().toISOString(),
    });
    logRecommendationEvent({
      event_name: "place_feedback",
      entity_type: "place",
      entity_id: "unknown",
      source_page: "feedback",
      recommendation_rank: null,
      place_snapshot: { feedback_type: type },
      metadata: { type, text, contact },
    });

    alert(
      "피드백 고마워! 베타 개선할 때 꼭 참고할게 🙏\n(지금은 데모라 서버로는 아직 안 보내져.)"
    );

    setText("");
    setContact("");
    setType("bug");
    router.back();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px 32px",
        boxSizing: "border-box",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
        }}
      >
        {/* 헤더 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              border: "none",
              background: "#ffffff",
              boxShadow: "0 4px 10px rgba(15,23,42,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ⬅️
          </button>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              하마에게 피드백 보내기
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              버그 / 아이디어 / 불편했던 점 / 좋았던 점, 뭐든지 편하게 적어줘.
            </div>
          </div>
        </header>

        {/* 카드 */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
            padding: "18px 16px 16px",
          }}
        >
          {/* 1) 피드백 종류 */}
          <section style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              어떤 종류의 피드백이야?
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[
                { key: "bug", label: "버그 / 오류" },
                { key: "ux", label: "사용성 / UX" },
                { key: "idea", label: "기능 아이디어" },
                { key: "etc", label: "기타" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setType(opt.key as "bug" | "ux" | "idea" | "etc")
                  }
                  style={{
                    flex: "1 1 40%",
                    borderRadius: 9999,
                    border: "none",
                    padding: "7px 0",
                    fontSize: 12,
                    cursor: "pointer",
                    background:
                      type === opt.key ? "#2563eb" : "#e5e7eb",
                    color:
                      type === opt.key ? "#ffffff" : "#111827",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* 2) 내용 */}
          <section style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              어떤 점을 알려줄까?
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`예)\n· "카페 추천해 줘"라고 말했는데 검색이 안 돼요.\n· 예약 화면에서 버튼이 헷갈려요.\n· 이런 기능도 있으면 좋겠어요!`}
              rows={6}
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "10px 12px",
                fontSize: 13,
                resize: "none",
                boxSizing: "border-box",
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
              }}
            />
          </section>

          {/* 3) 연락처 (선택) */}
          <section style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              연락받을 카카오톡 ID 또는 이메일 (선택)
            </div>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="적어주면 필요할 때만 한 번 연락드릴게요."
              style={{
                width: "100%",
                borderRadius: 9999,
                border: "1px solid #d1d5db",
                padding: "8px 12px",
                fontSize: 13,
                boxSizing: "border-box",
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
              }}
            />
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              광고/스팸은 절대 안 보내고, 꼭 필요할 때만 1회 정도 연락 드릴
              예정이야.
            </div>
          </section>

          {/* 제출 버튼 */}
          <button
            type="submit"
            style={{
              width: "100%",
              borderRadius: 9999,
              border: "none",
              padding: "10px 0",
              fontSize: 14,
              fontWeight: 700,
              background: "#2563eb",
              color: "#ffffff",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            피드백 보내기
          </button>
        </form>
      </div>
    </main>
  );
}
