"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PARTNER_APP_URL } from "../../lib/partnerUrl";

type Store = {
  id: string;
  name: string | null;
  category: string | null;
  area: string | null;
  owner_id: string | null;
};

type User = { id: string; nickname: string | null };

const DEBOUNCE_MS = 300;

export default function AdminStoresPage() {
  const [storeQuery, setStoreQuery] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const storeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStores = useCallback(async (q: string) => {
    setStoreLoading(true);
    try {
      const res = await fetch(`/api/admin/stores?q=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      setStores(data.stores ?? []);
    } catch {
      setStores([]);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (q: string) => {
    setUserLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeDebounce.current) clearTimeout(storeDebounce.current);
    storeDebounce.current = setTimeout(() => {
      fetchStores(storeQuery);
    }, storeQuery.trim() ? DEBOUNCE_MS : 0);
    return () => {
      if (storeDebounce.current) clearTimeout(storeDebounce.current);
    };
  }, [storeQuery, fetchStores]);

  useEffect(() => {
    if (userDebounce.current) clearTimeout(userDebounce.current);
    userDebounce.current = setTimeout(() => {
      if (userQuery.trim()) fetchUsers(userQuery);
      else setUsers([]);
    }, userQuery.trim() ? DEBOUNCE_MS : 0);
    return () => {
      if (userDebounce.current) clearTimeout(userDebounce.current);
    };
  }, [userQuery, fetchUsers]);

  const handleSave = async () => {
    if (!selectedStore) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${selectedStore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: selectedUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "저장 실패" });
        return;
      }
      setMessage({ type: "ok", text: "저장했어요." });
      setSelectedStore((prev) => (prev ? { ...prev, owner_id: selectedUserId } : null));
    } catch {
      setMessage({ type: "err", text: "저장 중 오류" });
    } finally {
      setSaving(false);
    }
  };

  const handleClearOwner = async () => {
    if (!selectedStore) return;
    setSelectedUserId(null);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stores/${selectedStore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "해제 실패" });
        return;
      }
      setMessage({ type: "ok", text: "연결 해제했어요." });
      setSelectedStore((prev) => (prev ? { ...prev, owner_id: null } : null));
    } catch {
      setMessage({ type: "err", text: "오류" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24, fontFamily: "Noto Sans KR, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>매장 · 매장주 연결</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/admin" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
            통계 대시보드
          </Link>
          <a
            href={PARTNER_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
          >
            매장주 대시보드
          </a>
          <Link href="/admin/reservations" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
            예약 목록
          </Link>
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
          매장 검색
        </label>
        <input
          type="text"
          value={storeQuery}
          onChange={(e) => setStoreQuery(e.target.value)}
          placeholder="매장명 입력"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        {storeLoading && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>검색 중...</div>}
        <div style={{ marginTop: 10 }}>
          {stores.slice(0, 15).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedStore(s);
                setSelectedUserId(s.owner_id);
                setUserQuery("");
                setUsers([]);
                setMessage(null);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                marginBottom: 6,
                textAlign: "left",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: selectedStore?.id === s.id ? "#EFF6FF" : "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.name ?? "(이름 없음)"}</span>
              {s.category && <span style={{ color: "#64748b", marginLeft: 8 }}>{s.category}</span>}
              {s.owner_id && (
                <span style={{ display: "block", fontSize: 11, color: "#16a34a", marginTop: 2 }}>연결됨</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {selectedStore && (
        <section
          style={{
            padding: 20,
            background: "#f8fafc",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>선택한 매장</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{selectedStore.name ?? "(이름 없음)"}</div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
            매장주(유저) 검색 후 선택
          </label>
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="닉네임 입력"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {userLoading && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>검색 중...</div>}
          <div style={{ marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  marginBottom: 4,
                  textAlign: "left",
                  border: "none",
                  borderRadius: 8,
                  background: selectedUserId === u.id ? "#DBEAFE" : "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {u.nickname ?? "(닉네임 없음)"} <span style={{ fontSize: 11, color: "#94a3b8" }}>({u.id.slice(0, 8)}…)</span>
              </button>
            ))}
          </div>

          {message && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                marginBottom: 12,
                background: message.type === "ok" ? "#dcfce7" : "#fee2e2",
                color: message.type === "ok" ? "#166534" : "#b91c1c",
                fontSize: 13,
              }}
            >
              {message.text}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "저장 중…" : "연결 저장"}
            </button>
            <button
              type="button"
              onClick={handleClearOwner}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              연결 해제
            </button>
          </div>
        </section>
      )}

      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 24 }}>
        매장을 검색해 선택한 뒤, 매장주로 연결할 유저를 검색해 선택하고 &quot;연결 저장&quot;을 누르세요. 위 &quot;매장주 대시보드&quot; 링크로 이동한 뒤 <strong>카카오 로그인</strong>하면, 그 계정에 연결된 매장의 통계를 볼 수 있어요.
      </p>
    </main>
  );
}
