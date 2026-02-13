"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReservationForm() {
  const [name, setName] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ts: new Date().toISOString() }),
    });
    setName("");
    router.refresh(); // 목록 새로고침
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-center">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름"
        className="border px-3 py-2 rounded"
        required
      />
      <button type="submit" className="px-3 py-2 border rounded">
        추가
      </button>
    </form>
  );
}
