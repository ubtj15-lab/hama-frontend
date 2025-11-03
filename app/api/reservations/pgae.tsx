"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  updatedAt: string;
  placeId: string | null;
  placeName: string;
  address: string;
  phonePlace: string | null;
  x: string | null;
  y: string | null;
  name: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  memo: string | null;
  source: string | null;
};

const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
};

export default function AdminReservations() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"createdAt" | "date" | "placeName" | "name">(
    "createdAt"
  );
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const url = `/api/reservations?sort=${sort}&order=${order}&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "load_failed");
      setRows(data.rows as Row[]);
    } catch (e: any) {
      setErr(e?.message ?? "unknown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order]);

  const onSearch = () => load();

  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제할까요? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      alert(`삭제 실패: ${data?.error ?? "unknown"}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const count = rows.length;

  const totalByDate = useMemo(() => {
    // YYYY-MM 별 카운트
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.date?.slice(0, 7) || "미지정";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  return (
    <div className="admin-wrap">
      <h1 className="admin-title">📋 예약 관리</h1>

      <div className="admin-toolbar">
        <input
          className="admin-input"
          placeholder="검색: 상호/이름/전화/주소"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button className="btn" onClick={onSearch}>
          검색
        </button>

        <div className="admin-spacer" />

        <select
          className="admin-select"
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "createdAt" | "date" | "placeName" | "name")
          }
        >
          <option value="createdAt">생성시간</option>
          <option value="date">예약일</option>
          <option value="placeName">상호명</option>
          <option value="name">고객명</option>
        </select>
        <select
          className="admin-select"
          value={order}
          onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
        >
          <option value="desc">내림차순</option>
          <option value="asc">오름차순</option>
        </select>
      </div>

      <div className="admin-stats">
        <div>총 {count}건</div>
        <div className="grow" />
        <div className="admin-chips">
          {totalByDate.map(([k, v]) => (
            <span key={k} className="chip">
              {k} <b>{v}</b>
            </span>
          ))}
        </div>
      </div>

      {err && <div className="admin-error">⚠ {err}</div>}
      {loading ? (
        <div className="admin-empty">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">데이터가 없습니다.</div>
      ) : (
        <div className="table">
          <div className="thead">
            <div>생성</div>
            <div>상호</div>
            <div>예약일시</div>
            <div>고객</div>
            <div>연락처</div>
            <div>인원</div>
            <div>요청사항</div>
            <div>액션</div>
          </div>

          <div className="tbody">
            {rows.map((r) => (
              <div key={r.id} className="tr">
                <div className="cell">{fmtDateTime(r.createdAt)}</div>
                <div className="cell">
                  <div className="bold">{r.placeName}</div>
                  <div className="sub">{r.address}</div>
                </div>
                <div className="cell">{r.date} {r.time}</div>
                <div className="cell">{r.name}</div>
                <div className="cell">{r.phone}</div>
                <div className="cell">{r.partySize}</div>
                <div className="cell sub">{r.memo ?? "-"}</div>
                <div className="cell">
                  <button className="btn danger" onClick={() => onDelete(r.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
