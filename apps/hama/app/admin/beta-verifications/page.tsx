"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PendingItem = {
  id: string;
  user_id: string;
  selected_place_id: string;
  selected_place_name: string | null;
  receipt_place_name: string | null;
  receipt_image_url: string | null;
  receipt_image_signed_url: string | null;
  feedback_tags?: string[];
  feedback_text?: string | null;
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
  rewards?: RewardTarget[];
  reward_targets: RewardTarget[];
  error?: string;
  detail?: string;
};
type AdminAction = "approve" | "reject";

function formatKstDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBetaVerificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");
  const [debugMessage, setDebugMessage] = React.useState("");
  const [pending, setPending] = React.useState<PendingItem[]>([]);
  const [rewardTargets, setRewardTargets] = React.useState<RewardTarget[]>([]);
  const [lastLoadStatus, setLastLoadStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastLoadInfo, setLastLoadInfo] = React.useState<{ ok: boolean; error?: string; detail?: string } | null>(null);

  const load = React.useCallback(async () => {
    setLastLoadStatus("loading");
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/beta-verifications?limit=120", { cache: "no-store" });
      const json = (await res.json()) as Res;
      if (!res.ok || !json.ok) {
        setLastLoadStatus("error");
        setLastLoadInfo({ ok: false, error: json.error, detail: json.detail });
        setMsg(json.error ?? "로드 실패");
        return;
      }
      const nextPending = Array.isArray(json.pending) ? json.pending : [];
      const rewardSource = json.rewards ?? json.reward_targets ?? [];
      const nextRewards = Array.isArray(rewardSource) ? rewardSource : [];
      setPending(nextPending);
      setRewardTargets(nextRewards);
      setLastLoadStatus("success");
      setLastLoadInfo({ ok: true });
      console.log("[admin beta verifications loaded]", {
        pendingCount: nextPending.length,
        rewardCount: nextRewards.length,
      });
    } catch {
      setLastLoadStatus("error");
      setLastLoadInfo({ ok: false, error: "fetch_failed" });
      setMsg("로드 중 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (verificationId: string, action: AdminAction) => {
    console.log("[admin verification action clicked]", { verificationId, action });
    if (action !== "approve" && action !== "reject") {
      setDebugMessage(`invalid action: ${String(action)}`);
      return;
    }
    if (savingId) return;
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
        newVisitCount?: number;
        counted?: boolean;
        updatedVerification?: { id: string; status: string; matched: boolean };
      };
      if (!res.ok || !json.ok) {
        console.error("[admin verification action response failed]", {
          status: res.status,
          data: json,
        });
        setMsg(`${action === "approve" ? "승인" : "거절"} 실패: ${json.error ?? "unknown"}`);
        alert(`${action === "approve" ? "승인" : "거절"} 실패: ${json.error ?? "unknown"}`);
        return;
      }
      setPending((prev) => prev.filter((item) => item.id !== verificationId));
      setMsg(
        `${action} 성공: pending 목록에서 제거됨 · visit_count: ${json.newVisitCount ?? "-"}`
      );
      await load();
      router.refresh();
    } catch {
      setMsg(`${action === "approve" ? "승인" : "거절"} 중 오류`);
      console.error("[admin verification action request failed]", { verificationId, action });
      alert(`${action === "approve" ? "승인" : "거절"} 중 오류`);
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
      <div
        style={{
          marginBottom: 12,
          borderRadius: 10,
          border: "1px solid #E2E8F0",
          background: "#fff",
          padding: "10px 12px",
          fontSize: 12,
          color: "#334155",
        }}
      >
        lastLoadStatus: <b>{lastLoadStatus}</b> · pendingCount: <b>{pending.length}</b> · rewardCount: <b>{rewardTargets.length}</b>
        <br />
        lastApi: <b>{lastLoadInfo ? (lastLoadInfo.ok ? "ok:true" : `ok:false (${lastLoadInfo.error ?? "unknown"})`) : "n/a"}</b>
        {debugMessage ? (
          <>
            <br />
            debugMessage: <b>{debugMessage}</b>
          </>
        ) : null}
      </div>

      <section style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>승인 대기 목록</div>
        <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>status = pending</div>
        {pending.length === 0 ? (
          <div style={{ color: "#64748B", fontSize: 13 }}>대기 중인 인증이 없어요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((p) => (
              <article key={p.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, background: "#fff" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 2fr 1fr 1.3fr", gap: 8, fontSize: 12, color: "#334155" }}>
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
                    <div>{formatKstDateTime(p.created_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>visit_count</div>
                    <div>{p.visit_count}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>영수증 이미지</div>
                    {p.receipt_image_signed_url ? (
                      <a href={p.receipt_image_signed_url} target="_blank" rel="noreferrer">
                        <img
                          src={p.receipt_image_signed_url}
                          alt="receipt"
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: "1px solid #E2E8F0",
                            background: "#fff",
                            cursor: "zoom-in",
                          }}
                        />
                      </a>
                    ) : (
                      <div style={{ color: "#94A3B8" }}>이미지 없음</div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#334155",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>후기 태그: </span>
                    {Array.isArray(p.feedback_tags) && p.feedback_tags.length > 0
                      ? p.feedback_tags.join(", ")
                      : "후기 없음"}
                  </div>
                  <div>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>한줄 후기: </span>
                    {typeof p.feedback_text === "string" && p.feedback_text.trim().length > 0
                      ? p.feedback_text
                      : "후기 없음"}
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
                    <div>{formatKstDateTime(r.last_visit_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>updated_at</div>
                    <div>{formatKstDateTime(r.updated_at)}</div>
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
