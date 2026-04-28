"use client";

import React from "react";

export type VisitSatisfaction = "good" | "neutral" | "bad";
export type VisitFeedbackPayload = {
  satisfaction: VisitSatisfaction;
  feedback_tags: string[];
  memo: string | null;
};

function tagOptions(satisfaction: VisitSatisfaction | null): string[] {
  if (satisfaction === "good") return ["맛있었어요", "가까웠어요", "분위기 좋았어요", "다시 갈래요"];
  if (satisfaction === "neutral" || satisfaction === "bad") {
    return ["멀었어요", "분위기가 아쉬웠어요", "가격이 아쉬웠어요", "다음엔 다른 곳"];
  }
  return [];
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: VisitFeedbackPayload) => Promise<void> | void;
  submitting?: boolean;
  placeName?: string | null;
};

export default function VisitFeedbackModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  placeName,
}: Props) {
  const [satisfaction, setSatisfaction] = React.useState<VisitSatisfaction | null>(null);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [memoText, setMemoText] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setSatisfaction(null);
    setSelectedTags([]);
    setMemoText("");
  }, [open]);

  if (!open) return null;

  const options = tagOptions(satisfaction);
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.45)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 420, borderRadius: 16, background: "#fff", padding: 16, display: "grid", gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>어땠어요?</h3>
        {placeName ? <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{placeName}</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { id: "good", label: "좋았어요" },
            { id: "neutral", label: "보통이에요" },
            { id: "bad", label: "별로였어요" },
          ].map((opt) => {
            const active = satisfaction === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = opt.id as VisitSatisfaction;
                  setSatisfaction(next);
                  // 만족도 축이 바뀌는 경우에만 태그를 초기화
                  setSelectedTags((prev) => (satisfaction && satisfaction !== next ? [] : prev));
                }}
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: active ? "1px solid #2563EB" : "1px solid #CBD5E1",
                  background: active ? "#EFF6FF" : "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {satisfaction ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {options.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  style={{
                    borderRadius: 999,
                    border: active ? "1px solid #16A34A" : "1px solid #CBD5E1",
                    background: active ? "#F0FDF4" : "#fff",
                    color: active ? "#166534" : "#334155",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ) : null}

        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          placeholder="한 줄 메모(선택)"
          rows={3}
          style={{
            width: "100%",
            borderRadius: 10,
            border: "1px solid #CBD5E1",
            padding: "10px 12px",
            fontSize: 13,
            resize: "vertical",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 42,
              borderRadius: 10,
              border: "1px solid #CBD5E1",
              background: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
          <button
            type="button"
            disabled={!satisfaction || submitting}
            onClick={() => {
              if (!satisfaction) return;
              const submitPayload: VisitFeedbackPayload = {
                satisfaction,
                feedback_tags: selectedTags,
                memo: memoText.trim() || null,
              };
              console.log("[visit-feedback-modal] submit payload:", submitPayload);
              void onSubmit(submitPayload);
            }}
            style={{
              height: 42,
              borderRadius: 10,
              border: "none",
              background: !satisfaction || submitting ? "#93C5FD" : "#2563EB",
              color: "#fff",
              fontSize: 13,
              fontWeight: 900,
              cursor: !satisfaction || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "저장 중..." : "피드백 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
