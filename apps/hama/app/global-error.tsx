"use client";

/**
 * 루트 레이아웃 밖 오류 — 반드시 html/body 포함.
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
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
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>HAMA — 심각한 오류</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 12, textAlign: "center", maxWidth: 400 }}>
            {error.message || "앱을 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
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
      </body>
    </html>
  );
}
