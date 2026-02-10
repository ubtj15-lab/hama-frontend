"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (loading) return;
    if (!confirm("정말 삭제할까요?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        alert("삭제 실패: " + (data.error || "unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("서버 통신 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      style={{
        background: "#ff6b6b",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
      title="삭제"
    >
      {loading ? "삭제중…" : "삭제"}
    </button>
  );
}
