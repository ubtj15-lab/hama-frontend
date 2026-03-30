import Link from "next/link";

export default function NotFound() {
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
      <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>페이지를 찾을 수 없어요</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>주소가 바뀌었거나 잘못된 링크일 수 있어요.</p>
      <Link
        href="/"
        style={{
          marginTop: 24,
          padding: "10px 20px",
          borderRadius: 999,
          background: "#2563eb",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        홈으로
      </Link>
    </div>
  );
}
