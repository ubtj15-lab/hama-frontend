"use client";

import React from "react";
import Link from "next/link";

type PendingItem = {
  id: string;
  user_id: string;
  selected_place_id: string;
  selected_place_name: string | null;
  receipt_place_name: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  matched: boolean;
  visit_count: number;
};

type RewardTarget = {
  user_id: string;
  visit_count: number;
  is_rewarded: boolean;
  updated_at: string | null;
  last_visit_at: string | null;
};

type Res = {
  ok: boolean;
  pending: PendingItem[];
  reward_targets: RewardTarget[];
  error?: string;
  detail?: string;
};

export default function AdminBetaVerificationsPage() {
  const [loading, setLoading] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");
  const [pending, setPending] = React.useState<PendingItem[]>([]);
  const [rewardTargets, setRewardTargets] = React.useState<RewardTarget[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/beta-verifications?limit=120", { cache: "no-store" });
      const json = (await res.json()) as Res;
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "로드 실패");
        return;
      }
      setPending(json.pending ?? []);
      setRewardTargets(json.reward_targets ?? []);
    } catch {
      setMsg("로드 중 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (verificationId: string, action: "approve" | "reject") => {
    setSavingId(verificationId);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/beta-verifications/${verificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        visit_count?: number;
      };
      if (!res.ok || !json.ok) {
        setMsg(`${action === "approve" ? "승인" : "거절"} 실패: ${json.error ?? "unknown"}`);
        return;
      }
      setMsg(`${action === "approve" ? "승인" : "거절"} 완료 (visit_count: ${json.visit_count ?? "-"})`);
      await load();
    } catch {
      setMsg(`${action === "approve" ? "승인" : "거절"} 중 오류`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24, fontFamily: "Noto Sans KR, system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>베타 인증 대시보드</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
            관리자 홈
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            style={{ border: "none", borderRadius: 10, background: "#111827", color: "#fff", fontWeight: 800, padding: "10px 14px", cursor: "pointer" }}
          >
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700 }}>
          {msg}
        </div>
      ) : null}

      <section style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>승인 대기 목록</div>
        <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>status = pending</div>
        {pending.length === 0 ? (
          <div style={{ color: "#64748B", fontSize: 13 }}>대기 중인 인증이 없어요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((p) => (
              <article key={p.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, background: "#fff" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 2fr 1fr", gap: 8, fontSize: 12, color: "#334155" }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>user_id</div>
                    <div>{p.user_id}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>receipt_place_name</div>
                    <div>{p.receipt_place_name ?? "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>selected_place_name</div>
                    <div>{p.selected_place_name ?? "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>created_at</div>
                    <div>{new Date(p.created_at).toLocaleString("ko-KR")}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>visit_count</div>
                    <div>{p.visit_count}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void act(p.id, "approve")}
                    disabled={savingId === p.id}
                    style={{
                      border: "1px solid #16A34A",
                      background: "#DCFCE7",
                      color: "#166534",
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {savingId === p.id ? "처리중..." : "승인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(p.id, "reject")}
                    disabled={savingId === p.id}
                    style={{
                      border: "1px solid #DC2626",
                      background: "#FEE2E2",
                      color: "#991B1B",
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {savingId === p.id ? "처리중..." : "거절"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>보상 대상자 목록</div>
        <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>visit_count &gt;= 3 또는 is_rewarded = true</div>
        {rewardTargets.length === 0 ? (
          <div style={{ color: "#64748B", fontSize: 13 }}>아직 보상 대상자가 없어요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rewardTargets.map((r) => (
              <div key={`${r.user_id}-${r.updated_at ?? ""}`} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, fontSize: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr 2fr", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>user_id</div>
                    <div>{r.user_id}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>visit_count</div>
                    <div>{r.visit_count}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>is_rewarded</div>
                    <div>{r.is_rewarded ? "true" : "false"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>last_visit_at</div>
                    <div>{r.last_visit_at ? new Date(r.last_visit_at).toLocaleString("ko-KR") : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>updated_at</div>
                    <div>{r.updated_at ? new Date(r.updated_at).toLocaleString("ko-KR") : "-"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
