"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { readCourseRunRecord } from "@/lib/session/courseSession";
import { colors, radius, typo } from "@/lib/designTokens";

/** 실행 중(active)일 때 진행 화면으로 이동 */
export function CourseExecutionBar({ courseId, stopCount }: { courseId: string; stopCount: number }) {
  const router = useRouter();
  const run = readCourseRunRecord(courseId);
  if (run.phase !== "active" || stopCount < 2) return null;
  return (
    <button
      type="button"
      onClick={() => router.push(`/course/progress?id=${encodeURIComponent(courseId)}`)}
      style={{
        width: "100%",
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: radius.card,
        border: `1px solid ${colors.borderSubtle}`,
        background: colors.accentSoft,
        color: colors.accentStrong,
        fontWeight: 800,
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left" as const,
      }}
    >
      진행 중 · 지금 위치 / 다음 장소 보기 →
    </button>
  );
}
