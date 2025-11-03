"use client";

import { useEffect, useRef, useState } from "react";

type Reservation = {
  id: string;
  name: string;
  createdAt: string; // ISO
};

export default function ReservationList() {
  // 상태
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // 입력/검색/정렬
  const [nameInput, setNameInput] = useState("");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // 음성 인식 UX (간단 토글)
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // 목록 불러오기
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations");
      const json = await res.json();
      setItems(json.results ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 추가
  const handleAdd = async () => {
    const name = nameInput.trim();
    if (!name) return;
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ts: new Date().toISOString() }),
    });
    const json = await res.json();
    if (json?.ok && json?.record) {
      setItems((prev) => [json.record, ...prev]); // 새 항목 상단
      setNameInput("");
    } else {
      alert(`추가 실패: ${json?.code ?? "UNKNOWN"}`);
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제할까요?")) return;
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json();
    if (json?.ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
    } else {
      alert(`삭제 실패: ${json?.code ?? "UNKNOWN"}`);
    }
  };

  // 디버그: 초기화 & 더미 10개
  const handleReset = async () => {
    if (!confirm("모든 예약을 초기화할까요?")) return;
    const res = await fetch("/api/debug/reset", { method: "POST" });
    const json = await res.json();
    if (json?.ok) {
      await load();
      alert(`초기화 완료 (삭제 ${json.deleted}건)`);
    } else {
      alert(`초기화 실패: ${json?.code ?? "UNKNOWN"}`);
    }
  };
  const handleSeed10 = async () => {
    const res = await fetch("/api/debug/seed?n=10", { method: "POST" });
    const json = await res.json();
    if (json?.ok) {
      await load();
    } else {
      alert(`더미 생성 실패: ${json?.code ?? "UNKNOWN"}`);
    }
  };

  // 음성 인식 (간단하게 nameInput 채우기)
  const toggleMic = async () => {
    // 브라우저 지원 체크
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const r: SpeechRecognition = new SR();
    recognitionRef.current = r;
    r.lang = "ko-KR";
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) setNameInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);

    setListening(true);
    r.start();
  };

  // 화면에 보여줄 리스트 (검색 + 정렬)
  const view = items
    .filter((r) => {
      const q = query.trim().toLowerCase();
      return q ? r.name.toLowerCase().includes(q) : true;
    })
    .sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });

  if (loading) return <div className="p-4">로딩중…</div>;

  return (
    <div className="space-y-4">
      {/* 상단 입력 + 음성 + 디버그 */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="이름을 입력하세요"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd}>추가</button>

        <button
          className={`btn ${listening ? "mic-pulse border-black/30" : ""}`}
          onClick={toggleMic}
          title="음성 입력"
        >
          {listening ? "🎙️ 듣는 중" : "🎙️ 음성 입력"}
        </button>

        <button className="btn" onClick={handleSeed10}>더미 10개</button>
        <button className="btn" onClick={handleReset}>초기화</button>
      </div>

      {/* 검색/정렬 + 카운트 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색"
        />
        <select
          className="select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
        >
          <option value="desc">최신순</option>
          <option value="asc">오래된순</option>
        </select>

        <span className="ml-auto badge">
          총 {items.length}건 / 표시 {view.length}건
        </span>
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {view.map((r) => (
          <div key={r.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <button className="btn btn-danger" onClick={() => handleDelete(r.id)}>삭제</button>
          </div>
        ))}

        {view.length === 0 && (
          <div className="text-gray-500">예약이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
