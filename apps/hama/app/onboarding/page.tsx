"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  COMPANION_OPTIONS,
  DEFAULT_USER_PROFILE,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  YOUNG_CHILD_OPTIONS,
  type CompanionOption,
  type DietaryOption,
  type InterestOption,
  type UserProfile,
} from "@/lib/onboardingProfile";

const CARD_STYLE: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#fff",
  padding: "12px 14px",
  textAlign: "left",
  cursor: "pointer",
  fontWeight: 700,
};

function OnboardingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("return_to") || "/";
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);

  const total = 5;
  const canNext = useMemo(() => {
    if (step === 0) return profile.companions.length > 0;
    if (step === 1) return profile.young_child === "있음" || profile.young_child === "없음";
    if (step === 2) return true;
    if (step === 3) return profile.dietary_restrictions.length > 0;
    return true;
  }, [step, profile]);

  const toggleCompanion = (value: CompanionOption) => {
    setProfile((prev) => {
      const now = new Set(prev.companions);
      if (now.has(value)) now.delete(value);
      else now.add(value);
      return { ...prev, companions: Array.from(now) };
    });
  };

  const toggleDietary = (value: DietaryOption) => {
    setProfile((prev) => {
      const current = new Set(prev.dietary_restrictions);
      if (value === "없음") {
        return { ...prev, dietary_restrictions: ["없음"] };
      }
      current.delete("없음");
      if (current.has(value)) current.delete(value);
      else current.add(value);
      return { ...prev, dietary_restrictions: normalizeDietary(Array.from(current)) };
    });
  };

  const toggleInterest = (value: InterestOption) => {
    setProfile((prev) => {
      const now = new Set(prev.interests);
      if (now.has(value)) now.delete(value);
      else now.add(value);
      return { ...prev, interests: Array.from(now) };
    });
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const localUserId = readLocalUserId();
      const res = await fetch("/api/users/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: localUserId,
          ...profile,
          onboarding_completed_at: new Date().toISOString(),
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; detail?: string; warning?: string; persisted?: boolean }
        | null;
      if (!res.ok || !json?.ok) {
        const reason = json?.error ? `${json.error}${json.detail ? `: ${json.detail}` : ""}` : `http_${res.status}`;
        throw new Error(reason);
      }
      if (json.warning === "missing_user_profile_column") {
        // DB 마이그레이션 반영 전에도 사용 흐름이 막히지 않도록 임시 로컬 보관
        localStorage.setItem(
          "hama_user_profile_pending",
          JSON.stringify({
            ...profile,
            onboarding_completed_at: new Date().toISOString(),
          })
        );
      }
      localStorage.setItem("hama_onboarding_prompt_dismissed", "1");
      router.replace(returnTo.startsWith("/") ? returnTo : "/");
    } catch (e) {
      console.error("[onboarding] save failed", e);
      const message = e instanceof Error ? e.message : "unknown_error";
      localStorage.setItem(
        "hama_user_profile_pending",
        JSON.stringify({
          ...profile,
          onboarding_completed_at: new Date().toISOString(),
          _save_error: message,
        })
      );
      localStorage.setItem("hama_onboarding_prompt_dismissed", "1");
      alert(`서버 저장에 실패했지만 임시 저장 후 진행할게요.\n원인: ${message}`);
      router.replace(returnTo.startsWith("/") ? returnTo : "/");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "20px 16px 28px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>
        <div style={{ color: "#475569", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          {step + 1}/{total}
        </div>
        <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 999, marginBottom: 16 }}>
          <div
            style={{
              width: `${((step + 1) / total) * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: "#2563eb",
            }}
          />
        </div>

        <section style={{ background: "#ffffff", borderRadius: 16, padding: 16, boxShadow: "0 4px 14px rgba(15,23,42,0.08)" }}>
          {step === 0 && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>누구랑 자주 가나요?</h1>
              <div style={{ display: "grid", gap: 10 }}>
                {COMPANION_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleCompanion(v)}
                    style={pickStyle(profile.companions.includes(v))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>영유아 자녀가 있으신가요?</h1>
              <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
                키즈카페·자녀 친화 매장 추천에만 반영돼요. 해당 없으면 없음을 골라 주세요.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {YOUNG_CHILD_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, young_child: v }))}
                    style={pickStyle(profile.young_child === v)}
                  >
                    {v === "있음" ? "있음 (자주 나감)" : "없음"}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>성별</h1>
              <div style={{ display: "grid", gap: 10 }}>
                {GENDER_OPTIONS.map((v) => (
                  <button key={v} type="button" onClick={() => setProfile((p) => ({ ...p, gender: v }))} style={pickStyle(profile.gender === v)}>
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>못 먹는 거 있어요?</h1>
              <div style={{ display: "grid", gap: 10 }}>
                {DIETARY_OPTIONS.map((v) => {
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleDietary(v)}
                      style={pickStyle(profile.dietary_restrictions.includes(v))}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>평소 좋아하는 곳?</h1>
              <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
                체크 안 해도 돼요. 좋아하는 거만 골라주세요.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {INTEREST_OPTIONS.map((v) => (
                  <button key={v} type="button" onClick={() => toggleInterest(v)} style={pickStyle(profile.interests.includes(v))}>
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={ghostButton(step === 0)}>
            이전
          </button>
          {step === 4 && (
            <button type="button" onClick={submit} disabled={saving} style={ghostButton(false)}>
              건너뛰기
            </button>
          )}
          <button
            type="button"
            onClick={() => (step === 4 ? submit() : setStep((s) => Math.min(total - 1, s + 1)))}
            disabled={!canNext || saving}
            style={primaryButton(!canNext || saving)}
          >
            {step === 4 ? (saving ? "저장 중..." : "완료") : "다음"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}>
          로딩 중...
        </main>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

function pickStyle(selected: boolean): React.CSSProperties {
  if (selected) {
    return {
      ...CARD_STYLE,
      border: "1px solid #2563eb",
      background: "#dbeafe",
      color: "#1e3a8a",
    };
  }
  return CARD_STYLE;
}

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: "none",
    borderRadius: 12,
    padding: "12px 14px",
    background: disabled ? "#93c5fd" : "#2563eb",
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 800,
  };
}

function ghostButton(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    background: "#fff",
    color: "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
  };
}

function normalizeDietary(next: DietaryOption[]): DietaryOption[] {
  if (next.includes("없음")) return ["없음"];
  const uniq = Array.from(new Set(next.filter((x) => x !== "없음")));
  return uniq.length ? uniq : ["없음"];
}

function readLocalUserId(): string | null {
  try {
    const raw = localStorage.getItem("hamaUser");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user_id?: unknown };
    return typeof parsed.user_id === "string" && parsed.user_id.length > 0 ? parsed.user_id : null;
  } catch {
    return null;
  }
}
