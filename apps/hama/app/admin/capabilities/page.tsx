"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type Coverage = {
  field: string;
  total: number;
  filled: number;
  percent: number;
  trueCount: number;
  truePercent: number;
  status: "ok" | "low" | "missing_column";
};

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

type Store = {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  address: string | null;
  description: string | null;
  tags: string[];
  mood: string[];
  capability: Capability;
};

type AuditResponse = {
  totalStores: number;
  columns: string[];
  filledColumns: string[];
  emptyColumns: string[];
  coverage: Coverage[];
  priorityStores: Store[];
  error?: string;
};

const capabilityKeys: Array<keyof Capability> = [
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

export default function AdminCapabilitiesPage() {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const loadAudit = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/capabilities/audit");
      const data = (await res.json()) as AuditResponse;
      if (!res.ok) {
        setMsg(data.error ?? "점검 실패");
      } else {
        setAudit(data);
      }
    } catch {
      setMsg("점검 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const [draft, setDraft] = useState<Record<string, Capability>>({});

  const stores = audit?.priorityStores ?? [];
  const mergedStores = useMemo(
    () =>
      stores.map((s) => ({
        ...s,
        capability: draft[s.id] ?? s.capability,
      })),
    [stores, draft]
  );

  const completed = mergedStores.filter((s) =>
    capabilityKeys.some((k) => s.capability[k] !== null && s.capability[k] !== undefined)
  ).length;

  const setBool = (storeId: string, key: keyof Capability, value: boolean) => {
    const base = mergedStores.find((s) => s.id === storeId)?.capability;
    if (!base) return;
    setDraft((prev) => ({ ...prev, [storeId]: { ...base, [key]: value } }));
  };

  const setNumber = (storeId: string, key: keyof Capability, value: number) => {
    const base = mergedStores.find((s) => s.id === storeId)?.capability;
    if (!base) return;
    setDraft((prev) => ({ ...prev, [storeId]: { ...base, [key]: value } }));
  };

  const saveOne = async (store: Store) => {
    setSavingStoreId(store.id);
    setMsg("");
    try {
      const body = draft[store.id] ?? store.capability;
      const res = await fetch(`/api/admin/capabilities/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "저장 실패");
      } else {
        setMsg(`저장 완료: ${store.name}`);
        setAudit((prev) =>
          prev
            ? {
                ...prev,
                priorityStores: prev.priorityStores.map((p) =>
                  p.id === store.id ? { ...p, capability: body } : p
                ),
              }
            : prev
        );
      }
    } catch {
      setMsg("저장 중 오류");
    } finally {
      setSavingStoreId(null);
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, fontFamily: "Noto Sans KR, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Capability 점검 + 수동 입력</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/admin" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
            관리자 홈
          </Link>
          <button
            type="button"
            onClick={loadAudit}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "점검 중..." : "점검 실행"}
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700 }}>
          {msg}
        </div>
      ) : null}

      {!audit ? (
        <p style={{ color: "#64748B" }}>점검 실행 버튼을 누르면 stores 컬럼/커버리지와 우선 100개 매장 목록이 로드됩니다.</p>
      ) : (
        <>
          <section style={{ marginBottom: 14, border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>기본 분류 점검</div>
            <div style={{ fontSize: 14, color: "#334155", marginBottom: 6 }}>총 매장: {audit.totalStores.toLocaleString()}개</div>
            <div style={{ fontSize: 13, color: "#334155" }}>
              <strong>분류 관련 컬럼 확인:</strong> category / tags / description / mood 포함 여부 ={" "}
              {["category", "tags", "description", "mood"].every((c) => audit.columns.includes(c)) ? "OK" : "일부 누락"}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              채워진 컬럼: {audit.filledColumns.join(", ")}
            </div>
            {audit.emptyColumns.length ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#B45309" }}>
                비어있는 컬럼: {audit.emptyColumns.join(", ")}
              </div>
            ) : null}
          </section>

          <section style={{ marginBottom: 14, border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Capability 커버리지</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {audit.coverage.map((c) => (
                <div
                  key={c.field}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: c.status === "ok" ? "#F0FDF4" : c.status === "low" ? "#FFF7ED" : "#FEF2F2",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{c.field}</div>
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    데이터 채워짐: {c.filled}/{c.total} ({c.percent}%)
                  </div>
                  <div style={{ fontSize: 12, color: "#0F172A", marginTop: 2 }}>
                    true 비율: {c.trueCount}/{c.total} ({c.truePercent}%)
                  </div>
                  {c.percent < 50 ? <div style={{ fontSize: 12, color: "#C2410C" }}>매장 데이터 부족</div> : null}
                </div>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 14, border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>우선순위 100개 (오산/동탄 중심)</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
              진행률: <strong>{completed}</strong> / <strong>{mergedStores.length}</strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mergedStores.map((s) => (
                <article key={s.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        {s.category ?? "-"} · {s.area ?? "-"} · {s.address ?? "-"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveOne(s)}
                      disabled={savingStoreId === s.id}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 12px",
                        background: "#2563EB",
                        color: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {savingStoreId === s.id ? "저장중..." : "저장"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6 }}>
                    {capabilityKeys
                      .filter((k) => k !== "max_group_size")
                      .map((k) => (
                        <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(s.capability[k] === true)}
                            onChange={(e) => setBool(s.id, k, e.target.checked)}
                          />
                          {k}
                        </label>
                      ))}
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      max_group_size
                      <select
                        value={String(s.capability.max_group_size ?? 4)}
                        onChange={(e) => setNumber(s.id, "max_group_size", Number(e.target.value))}
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
          </section>
        </>
      )}
    </main>
  );
}
