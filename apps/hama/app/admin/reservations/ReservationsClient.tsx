"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

/* ---------- 타입 ---------- */
type Reservation = {
  id: string;
  createdAt: string; // ISO string
  store: string;
  address: string;
  phone: string;
  name: string;
  people: number;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:mm'
  note?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/* ---------- 상단 네비/로그아웃 바 ---------- */
function AdminTopbar() {
  const onLogout = async () => {
    window.location.href = "/api/auth/kakao/logout";
  };
  return (
    <div className="flex justify-end items-center gap-3 mb-4">
      <a href="/admin" className="text-sm text-blue-600 hover:underline">
        통계 대시보드
      </a>
      <a href="/admin/stores" className="text-sm text-blue-600 hover:underline">
        매장 연결
      </a>
      <button
        onClick={onLogout}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        title="관리자 로그아웃"
      >
        로그아웃
      </button>
    </div>
  );
}

/* ---------- 유틸 ---------- */
const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}. ${mo}. ${da}. ${hh}:${mm}`;
  } catch {
    return iso;
  }
};

/* ---------- 본문 ---------- */
export default function ReservationsPage() {
  const searchParams = useSearchParams();

  // 목록
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // 지도 파라미터(있으면 상단 카드에 노출)
  const preset = useMemo(() => {
    // ?store=&addr=&phone=&name=&people=&date=&time=&note=&x=&y=
    const get = (k: string) => (searchParams?.get(k) ?? "").trim();
    const p = {
      store: get("store"),
      address: get("addr"),
      phone: get("phone"),
      name: get("name"),
      people: get("people"),
      date: get("date"),
      time: get("time"),
      note: get("note"),
      x: get("x"),
      y: get("y"),
    };
    const hasAny = Object.values(p).some((v) => v);
    return hasAny ? p : null;
  }, [searchParams]);

  /* ----- 목록 로드 ----- */
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reservations", { method: "GET" });
      const data = await r.json();
      if (r.ok && data?.ok) {
        setItems(data.items || []);
      } else {
        console.error(data);
        alert("목록을 불러오지 못했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("목록 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ----- 검색 ----- */
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const qq = q.trim().toLowerCase();
    return items.filter((r) =>
      [
        r.id,
        r.store,
        r.address,
        r.phone,
        r.name,
        r.note ?? "",
        r.date,
        r.time,
      ]
        .join(" ")
        .toLowerCase()
        .includes(qq),
    );
  }, [items, q]);

  /* ----- 하나 삭제 ----- */
  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제할까요?")) return;
    try {
      const r = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        alert("삭제 실패");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  /* ----- 상단 카드: 한 번에 복사 ----- */
  const copyAll = async () => {
    if (!preset) return;
    const lines = [
      `가게명: ${preset.store || "-"}`,
      `주소: ${preset.address || "-"}`,
      `전화: ${preset.phone || "-"}`,
      `좌표: ${preset.y || "-"}, ${preset.x || "-"}`,
    ].join("\n");
    await navigator.clipboard.writeText(lines);
    alert("복사 완료!");
  };

  /* ----- 상단 카드: 자동 등록(실제) ----- */
  const autoCreate = async () => {
    if (!preset) return;
    try {
      const body = {
        store: preset.store || "-",
        address: preset.address || "-",
        phone: preset.phone || "-",
        name: preset.name || "하마자동등록",
        people: Number(preset.people || 1),
        date: preset.date || new Date().toISOString().slice(0, 10),
        time: preset.time || "12:00",
        note: preset.note || "",
        lat: preset.y ? Number(preset.y) : null,
        lng: preset.x ? Number(preset.x) : null,
      };

      const r = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        alert("예약 생성 실패");
        return;
      }
      alert("예약 정보가 DB에 등록되었습니다!");
      load();
    } catch (e) {
      console.error(e);
      alert("예약 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AdminTopbar />

      <h1 className="mb-4 text-2xl font-bold">예약 내역</h1>

      {/* 상단: 지도에서 온 파라미터 요약 */}
      <div className="mb-6 rounded-lg border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sky-600">💙 지도에서 전달된 예약 정보</span>
        </div>

        <div className="text-sm leading-6 text-gray-700">
          <div>가게명: {preset?.store || "-"}</div>
          <div>주소: {preset?.address || "-"}</div>
          <div>전화: {preset?.phone || "-"}</div>
          <div>
            좌표: {preset?.y || "-"}, {preset?.x || "-"}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={copyAll}
            className="rounded-md bg-gray-700 px-3 py-2 text-sm text-white hover:opacity-90"
          >
            한 번에 복사
          </button>
          <button
            onClick={autoCreate}
            className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:opacity-90"
          >
            ⚡ 자동 등록(실제)
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색: 가게명/주소/전화/이름/비고/날짜/시간…"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button
          onClick={load}
          className="whitespace-nowrap rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
        >
          🔄 조회
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">생성일</th>
              <th className="px-3 py-2">가게명</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2">전화</th>
              <th className="px-3 py-2">예약자</th>
              <th className="px-3 py-2">인원</th>
              <th className="px-3 py-2">예약일</th>
              <th className="px-3 py-2">시간</th>
              <th className="px-3 py-2">비고</th>
              <th className="px-3 py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  아직 데이터가 없습니다. 상단에서 “자동 등록(실제)”을 눌러 생성해보세요.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2">{r.store}</td>
                  <td className="px-3 py-2">{r.address}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.people}</td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.time}</td>
                  <td className="px-3 py-2">{r.note || ""}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onDelete(r.id)}
                      className="rounded-md bg-rose-500 px-2 py-1 text-xs text-white hover:opacity-90"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
