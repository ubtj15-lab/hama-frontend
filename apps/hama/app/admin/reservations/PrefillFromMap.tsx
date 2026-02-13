"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function PrefillFromMap() {
  const params = useSearchParams();
  const router = useRouter();

  // 지도에서 넘어온 파라미터
  const store = params.get("store") || "";
  const address = params.get("addr") || "";
  const phone = params.get("phone") || "";
  const y = params.get("y") || "";
  const x = params.get("x") || "";

  // 아무 값도 없으면 배너 숨김
  const hasAny = !!(store || address || phone || (x && y));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!hasAny || !visible) return null;

  // 복사용 페이로드
  const payload = {
    store,
    address,
    phone,
    geo: { y, x },
  };

  // 📋 한 번에 복사
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
      alert("복사에 실패했어요. 수동으로 복사해주세요.");
    }
  };

  // ⚡ 실제 DB 저장
  const saveToDB = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.ok) {
        alert("✅ 예약 정보가 DB에 등록되었습니다!");
        router.refresh(); // 목록 즉시 갱신
        // (선택) 쿼리 파라미터 제거하고 싶으면 아래 3줄 주석 해제
        // const url = new URL(window.location.href);
        // url.search = "";
        // window.history.replaceState({}, "", url.toString());
      } else {
        alert("❌ 저장 실패: " + (data?.error || "unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("서버 통신 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 16,
        borderRadius: 12,
        background: "#f7faff",
        border: "1px solid #cfe0ff",
      }}
    >
      <h3 style={{ fontWeight: 800, marginBottom: 8 }}>💙 지도에서 전달된 예약 정보</h3>

      <div style={{ lineHeight: 1.7 }}>
        <div>
          <b>가게명:</b> {store || "-"}
        </div>
        <div>
          <b>주소:</b> {address || "-"}
        </div>
        <div>
          <b>전화:</b> {phone || "-"}
        </div>
        <div>
          <b>좌표:</b> {y && x ? `${y}, ${x}` : "-"}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={copyAll}
          style={{
            background: copied ? "#27ae60" : "#2d8cff",
            color: "#fff",
            padding: "8px 14px",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {copied ? "복사 완료!" : "📋 한 번에 복사"}
        </button>

        <button
          onClick={saveToDB}
          disabled={saving}
          style={{
            background: "#0ecb81",
            color: "#fff",
            padding: "8px 14px",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "저장 중..." : "⚡ 자동 등록(실제)"}
        </button>

        <button
          onClick={() => setVisible(false)}
          style={{
            background: "#e3e3e3",
            color: "#333",
            padding: "8px 14px",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          파라미터 숨기기
        </button>
      </div>
    </div>
  );
}
