// app/components/QuickReserve.tsx
"use client";

import { useState } from "react";

export type PresetPlace = {
  store: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  preset?: PresetPlace | null;
  onSaved?: () => void; // 저장 성공 시 콜백
};

export default function QuickReserve({ open, onClose, preset, onSaved }: Props) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open || !preset) return null;

  const submit = async () => {
    if (!preset.store || !preset.address) {
      alert("가게명/주소가 비어 있습니다."); 
      return;
    }
    if (!name || !date || !time) {
      alert("예약자 이름, 날짜, 시간을 입력해주세요.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: preset.store,
          address: preset.address,
          phone: preset.phone ?? "",
          name,
          people,
          date,
          time,
          note,
          lat: preset.lat ?? null,
          lng: preset.lng ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || "예약 저장 실패");
      }
      alert("예약이 저장되었습니다!");
      // 입력값 초기화
      setName(""); setPeople(1); setDate(""); setTime(""); setNote("");
      onClose();
      onSaved?.();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>빠른 예약</h3>

        <div style={row}><label>가게명</label><div>{preset.store}</div></div>
        <div style={row}><label>주소</label><div>{preset.address}</div></div>
        <div style={row}><label>전화</label><div>{preset.phone || "-"}</div></div>

        <div style={row}>
          <label>예약자</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="이름" />
        </div>
        <div style={row}>
          <label>인원</label>
          <input type="number" value={people} min={1} onChange={e=>setPeople(parseInt(e.target.value||"1"))} />
        </div>
        <div style={row}>
          <label>날짜</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div style={row}>
          <label>시간</label>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} />
        </div>
        <div style={row}>
          <label>메모</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="요청사항" />
        </div>

        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button onClick={onClose} disabled={loading}>닫기</button>
          <button onClick={submit} disabled={loading} style={{ background:"#2563eb", color:"#fff" }}>
            {loading ? "저장 중..." : "예약 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 간단한 인라인 스타일
const backdropStyle: React.CSSProperties = {
  position:"fixed", inset:0, background:"rgba(0,0,0,.35)",
  display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999,
};
const modalStyle: React.CSSProperties = {
  width: 420, background:"#fff", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,.2)"
};
const row: React.CSSProperties = {
  display:"grid", gridTemplateColumns:"90px 1fr", gap:8, alignItems:"center", marginTop:8
};
