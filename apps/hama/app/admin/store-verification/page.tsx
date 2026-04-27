"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";

type Capability = {
  solo_friendly: boolean | null;
  group_seating: boolean | null;
  private_room: boolean | null;
  alcohol_available: boolean | null;
  fast_food: boolean | null;
  formal_atmosphere: boolean | null;
  quick_service: boolean | null;
  vegan_available: boolean | null;
  halal_available: boolean | null;
  with_kids: boolean | null;
  max_group_size: number | null;
};

type VerifyStore = {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  address: string | null;
  image_url?: string | null;
  mood: string[];
  tags: string[];
  description: string | null;
  inferred: Capability;
  actual: Capability;
  mismatch: string[];
  ai_confidence: number | null;
  verified_by_human: boolean;
  final_capability: Capability | null;
};

type VerifyResponse = {
  totalStores: number;
  mismatchStores: number;
  stores: VerifyStore[];
  error?: string;
};

const CAP_KEYS: Array<keyof Capability> = [
  "solo_friendly",
  "group_seating",
  "private_room",
  "alcohol_available",
  "fast_food",
  "formal_atmosphere",
  "quick_service",
  "vegan_available",
  "halal_available",
  "with_kids",
  "max_group_size",
];

export default function AdminStoreVerificationPage() {
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<Record<string, Capability>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/store-verification?limit=40");
      const json = (await res.json()) as VerifyResponse;
      if (!res.ok) setMsg(json.error ?? "로드 실패");
      else setData(json);
    } catch {
      setMsg("로드 중 오류");
    } finally {
      setLoading(false);
    }
  };

  const stores = data?.stores ?? [];
  const merged = useMemo(
    () =>
      stores.map((s) => {
        const base = s.final_capability ?? s.actual;
        return { ...s, effective: draft[s.id] ?? base };
      }),
    [stores, draft]
  );

  const verifiedCount = merged.filter((s) => s.verified_by_human).length;
  const nextUnverified = merged.find((s) => !s.verified_by_human);

  const moveToStore = (storeId?: string) => {
    if (!storeId) return;
    const el = cardRefs.current[storeId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const moveToNextUnverified = (currentId?: string) => {
    if (!merged.length) return;
    const startIdx = currentId ? merged.findIndex((m) => m.id === currentId) : -1;
    const from = startIdx >= 0 ? startIdx + 1 : 0;
    const next = [...merged.slice(from), ...merged.slice(0, from)].find((m) => !m.verified_by_human);
    if (next) moveToStore(next.id);
  };

  const setBool = (storeId: string, key: keyof Capability, v: boolean) => {
    const item = merged.find((m) => m.id === storeId);
    if (!item) return;
    setDraft((prev) => ({
      ...prev,
      [storeId]: { ...item.effective, [key]: v },
    }));
  };
  const setNum = (storeId: string, key: keyof Capability, v: number) => {
    const item = merged.find((m) => m.id === storeId);
    if (!item) return;
    setDraft((prev) => ({
      ...prev,
      [storeId]: { ...item.effective, [key]: v },
    }));
  };

  const save = async (store: (typeof merged)[number]) => {
    setSaving(store.id);
    setMsg("");
    try {
      const body = draft[store.id] ?? store.effective;
      const res = await fetch(`/api/admin/store-verification/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setMsg(json.error ?? "저장 실패");
      else {
        setMsg(`확정 저장 완료: ${store.name}`);
        setData((prev) =>
          prev
            ? {
                ...prev,
                stores: prev.stores.map((s) =>
                  s.id === store.id
                    ? { ...s, verified_by_human: true, final_capability: body }
                    : s
                ),
              }
            : prev
        );
        setTimeout(() => moveToNextUnverified(store.id), 120);
      }
    } catch {
      setMsg("저장 중 오류");
    } finally {
      setSaving(null);
    }
  };

  const quickApprove = async (store: (typeof merged)[number]) => {
    const body = store.effective;
    setDraft((prev) => ({ ...prev, [store.id]: body }));
    await save(store);
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, fontFamily: "Noto Sans KR, system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>매장 분류 수동 검증</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/admin" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
            관리자 홈
          </Link>
          <button
            type="button"
            onClick={load}
            style={{ border: "none", background: "#111827", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            {loading ? "불러오는 중..." : "우선 매장 40개 로드"}
          </button>
          <button
            type="button"
            onClick={() => moveToStore(nextUnverified?.id)}
            disabled={!data || !nextUnverified}
            style={{
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#0F172A",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 800,
              cursor: !data || !nextUnverified ? "not-allowed" : "pointer",
            }}
          >
            다음 미검증으로 이동
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700 }}>{msg}</div>
      ) : null}

      {!data ? (
        <p style={{ color: "#64748B" }}>우선 매장 40개 로드 버튼을 눌러 수동 capability 입력을 시작하세요.</p>
      ) : (
        <>
          <section style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>요약</div>
            <div style={{ fontSize: 13, color: "#334155" }}>
              전체 매장: {data.totalStores} · 불일치 매장: {data.mismatchStores} · 현재 리스트: {data.stores.length}
            </div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>
              진행률(확정): {verifiedCount}/{data.stores.length}
            </div>
          </section>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {merged.map((s) => (
              <article
                key={s.id}
                ref={(el) => {
                  cardRefs.current[s.id] = el;
                }}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: 12,
                  background: s.verified_by_human ? "#F8FAFC" : "#fff",
                  boxShadow: s.verified_by_human ? "inset 0 0 0 1px #BFDBFE" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      {s.category ?? "-"} · {s.area ?? "-"} · {s.address ?? "-"}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
                      mood: {s.mood.join(", ") || "-"} / tags: {s.tags.join(", ") || "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => quickApprove(s)}
                      disabled={saving === s.id}
                      style={{
                        border: "1px solid #16A34A",
                        borderRadius: 8,
                        padding: "8px 12px",
                        background: "#DCFCE7",
                        color: "#166534",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {saving === s.id ? "처리중..." : "자동 매핑 OK (빠른 확정)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => save(s)}
                      disabled={saving === s.id}
                      style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#2563EB", color: "#fff", fontWeight: 800, cursor: "pointer" }}
                    >
                      {saving === s.id ? "저장중..." : s.verified_by_human ? "확정 업데이트" : "확정"}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  차이 필드:{" "}
                  <span style={{ color: "#B91C1C", fontWeight: 800 }}>
                    {s.mismatch.length ? s.mismatch.join(", ") : "없음"}
                  </span>
                </div>

                {s.image_url ? (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={s.image_url}
                      alt={`${s.name} 매장 사진`}
                      style={{ width: "100%", maxWidth: 360, borderRadius: 10, border: "1px solid #E2E8F0", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: 8, fontSize: 12, color: "#64748B" }}>매장 사진 없음</div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>너 분류 → capability 추정</div>
                    <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(s.inferred, null, 2)}</pre>
                  </div>
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>AI/현재 capability</div>
                    <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(s.actual, null, 2)}</pre>
                  </div>
                </div>

                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
                  {CAP_KEYS.filter((k) => k !== "max_group_size").map((k) => (
                    <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: s.mismatch.includes(String(k)) ? "#B91C1C" : "#111827" }}>
                      <input type="checkbox" checked={Boolean(s.effective[k] === true)} onChange={(e) => setBool(s.id, k, e.target.checked)} />
                      {k}
                    </label>
                  ))}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    max_group_size
                    <select
                      value={String(s.effective.max_group_size ?? 4)}
                      onChange={(e) => setNum(s.id, "max_group_size", Number(e.target.value))}
                      style={{ border: "1px solid #CBD5E1", borderRadius: 6, padding: "3px 6px" }}
                    >
                      <option value="4">4</option>
                      <option value="8">8</option>
                      <option value="12">12</option>
                      <option value="20">20</option>
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
