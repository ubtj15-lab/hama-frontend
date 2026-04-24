"use client";

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  readCoursePlanWithFallback,
  stashCoursePlan,
} from "@/lib/session/courseSession";
import { getOrCreateSessionId, getUserId } from "@hama/shared";
import { colors, radius, shadow, space } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { logEvent } from "@/lib/logEvent";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";

function CourseProgressInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [ready, setReady] = useState(false);
  const loggedOnce = useRef(false);

  useLayoutEffect(() => {
    if (!id || typeof window === "undefined") {
      setReady(true);
      return;
    }
    const h = window.location.hash;
    const hashSnap = h.startsWith("#hamaCourseSnap=")
      ? decodeURIComponent(h.slice("#hamaCourseSnap=".length))
      : undefined;
    const search = new URLSearchParams(window.location.search);
    const qSnap = search.get("courseSnap")?.trim() ?? undefined;
    const { plan: p } = readCoursePlanWithFallback(id, { courseSnapB64: qSnap, hashSnapB64: hashSnap });
    setPlan(p);
    if (p) stashCoursePlan(p);
    setReady(true);
  }, [id, courseSnapQ]);

  const placeName = useMemo(
    () => sp.get("placeName")?.trim() || plan?.stops?.[0]?.placeName || "추천 장소",
    [sp, plan?.stops]
  );
  const distanceLabel = sp.get("distance")?.trim() || "2.3km";
  const durationLabel = sp.get("duration")?.trim() || "8분";
  const phone = sp.get("phone")?.trim() || "";
  const scenario = sp.get("scenario")?.trim() || plan?.scenario || "generic";
  const entityType = sp.get("entity_type")?.trim() || "place";
  const entityId = sp.get("entity_id")?.trim() || plan?.stops?.[0]?.placeId || id || "";
  const recommendationRank = Number(sp.get("recommendation_rank") || "1");
  const snapshot = courseSnapQ || sp.get("snapshot")?.trim() || "";

  useEffect(() => {
    if (!ready || loggedOnce.current) return;
    loggedOnce.current = true;
    const payload = {
      session_id: getOrCreateSessionId(),
      user_id: getUserId(),
      scenario,
      entity_type: entityType,
      entity_id: entityId,
      recommendation_rank: Number.isFinite(recommendationRank) ? recommendationRank : 1,
      snapshot: snapshot || null,
    };
    logEvent("decision_complete", payload);
    logRecommendationEvent({
      event_name: "decision_complete",
      entity_type: entityType === "course" ? "course" : "place",
      entity_id: String(entityId),
      scenario,
      recommendation_rank: payload.recommendation_rank,
      source_page: "decision_complete",
      place_snapshot: entityType === "place" ? { id: entityId, name: placeName } : null,
      course_snapshot: entityType === "course" ? { id: entityId, snap: snapshot || null } : null,
      metadata: payload,
    });
  }, [ready, scenario, entityType, entityId, recommendationRank, snapshot]);

  if (!ready) {
    return (
      <main style={{ padding: space.pageX }}>
        <p>불러오는 중…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        padding: `16px ${space.pageX}px 30px`,
        background: colors.bgDefault,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => (id ? router.push(`/course?id=${encodeURIComponent(id)}`) : router.back())}
          style={{ border: "none", background: "none", color: colors.textPrimary, fontWeight: 900, cursor: "pointer", fontSize: 20 }}
        >
          ←
        </button>
        <strong style={{ fontSize: 18, letterSpacing: "-0.02em" }}>결정 완료</strong>
      </header>

      <section style={{ textAlign: "center", marginTop: 26 }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🎉 ✨ 🎊</div>
        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: "50%",
            margin: "0 auto",
            background: "#22C55E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 40,
            fontWeight: 900,
            boxShadow: "0 12px 24px rgba(34,197,94,0.28)",
          }}
        >
          ✓
        </div>
        <h1 style={{ margin: "14px 0 6px", fontSize: 31, lineHeight: 1.2, letterSpacing: "-0.04em" }}>오케이, 여기로 가자!</h1>
        <p style={{ margin: 0, color: colors.textSecondary, fontSize: 14, fontWeight: 700 }}>{placeName}으로 가는 길을 안내할게</p>
      </section>

      <section
        style={{
          marginTop: 18,
          borderRadius: radius.card,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#fff",
          padding: 14,
          boxShadow: shadow.soft,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚗</span>
          <div>
            <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.03em" }}>
              {durationLabel} ({distanceLabel})
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>실시간 길 안내 준비 중</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            const first = plan?.stops?.[0];
            openDirections({ name: placeName, lat: first?.lat ?? null, lng: first?.lng ?? null });
          }}
          style={{
            width: "100%",
            height: 50,
            borderRadius: radius.button,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(17,24,39,0.2)",
          }}
        >
          지금 출발하기 →
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (!id) return;
              const url =
                typeof window !== "undefined"
                  ? window.location.href
                  : `/course/progress?id=${encodeURIComponent(id)}`;
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: "결정 완료", text: `${placeName}로 출발!`, url });
              }
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderStrong}`,
              background: "#fff",
              color: colors.textPrimary,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            공유하기
          </button>

          {phone && (
            <button
              type="button"
              onClick={() => {
                const tel = phone.replace(/[^0-9+]/g, "");
                if (tel) window.location.href = `tel:${tel}`;
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.button,
                border: `1px solid ${colors.borderStrong}`,
                background: "#fff",
                color: colors.textPrimary,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              전화하기
            </button>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 14,
          borderRadius: radius.card,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#FFF9F2",
          padding: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 5 }}>🐥 갔다 와서 한 번만 알려줘</div>
        <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, fontWeight: 700, lineHeight: 1.45 }}>
          어땠는지 피드백 남겨주면 하마가 더 똑똑해져
        </p>
      </section>

      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          width: "100%",
          marginTop: 16,
          border: "none",
          background: "transparent",
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "underline",
          cursor: "pointer",
          padding: "8px 0",
        }}
      >
        처음으로 돌아가기
      </button>
    </main>
  );
}

export default function CourseProgressPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩…</div>}>
      <CourseProgressInner />
    </Suspense>
  );
}
