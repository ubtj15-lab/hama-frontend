"use client";

import { useState } from "react";

export default function AddReservationForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ts: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`생성 실패 (${res.status})`);
      setName("");
      onAdded(); // 생성 후 목록 새로고침
    } catch (err) {
      alert((err as Error).message ?? "생성 중 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름 입력"
        className="border rounded px-3 py-2 text-sm grow"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
      >
        {loading ? "추가 중…" : "추가"}
      </button>
    </form>
  );
}
