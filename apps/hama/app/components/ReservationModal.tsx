"use client";

import { useEffect, useMemo, useState } from "react";

export type PresetPlace = {
  store: string;
  address: string;
  phone?: string;
  x: string; // kakao 좌표(경도)
  y: string; // kakao 좌표(위도)
};

type Props = {
  open: boolean;
  onClose: () => void;
  preset: PresetPlace | null;
};

function todayYYYYMMDD() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function ReservationModal({ open, onClose, preset }: Props) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState<number>(1);
  const [date, setDate] = useState(todayYYYYMMDD());
  const [time, setTime] = useState("12:00");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // 허니팟(봇 방지)
  const [trap, setTrap] = useState("");

  // 모달 열릴 때마다 기본값 리셋
  useEffect(() => {
    if (open) {
      setName("");
      setPeople(1);
      setDate(todayYYYYMMDD());
      setTime("12:00");
      setNote("");
      setTrap("");
    }
  }, [open]);

  const disabled = useMemo(
    () => loading || !preset || !name || people < 1 || people > 20 || !date || !time || !!trap,
    [loading, preset, name, people, date, time, trap]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preset) return;
    if (disabled) return;

    setLoading(true);
    try {
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
          lat: parseFloat(preset.y), // kakao: y=위도, x=경도
          lng: parseFloat(preset.x),
        }),
      });

      if (!res.ok) throw new Error("예약 등록 실패");
      alert("✅ 예약이 등록되었습니다!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("예약 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !preset) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">예약하기</h2>
          <button
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        {/* 가게 정보 (읽기 전용) */}
        <div className="mb-4 space-y-1 rounded-md border p-3 text-sm">
          <div>
            <span className="font-medium">가게명:</span> {preset.store || "-"}
          </div>
          <div>
            <span className="font-medium">주소:</span> {preset.address || "-"}
          </div>
          <div>
            <span className="font-medium">전화:</span> {preset.phone || "-"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 허니팟 */}
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">예약자 이름 *</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">인원(1~20) *</label>
              <input
                type="number"
                min={1}
                max={20}
                className="w-full rounded-md border px-3 py-2"
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">날짜 *</label>
              <input
                type="date"
                min={todayYYYYMMDD()}
                className="w-full rounded-md border px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">시간 *</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">요청사항(선택)</label>
              <textarea
                rows={3}
                className="w-full rounded-md border px-3 py-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 유아 의자 1개 필요"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "등록 중..." : "예약 등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
