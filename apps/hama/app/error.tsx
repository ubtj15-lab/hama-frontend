"use client";

import { useEffect } from "react";

/**
 * 세그먼트 오류 경계 — Next App Router 필수에 가까운 구성.
 * "missing required error components" 완화 및 실제 오류 메시지 확인용.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F8FAFC",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
        잠시 문제가 생겼어요
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 8px", textAlign: "center", maxWidth: 360 }}>
        {error.message || "알 수 없는 오류입니다."}
      </p>
      {error.digest ? (
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 20px" }}>코드: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: "10px 20px",
          borderRadius: 999,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
