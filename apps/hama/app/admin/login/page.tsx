"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { kakaoLoginUrl } from "@/lib/auth/kakaoLogin";

function adminNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("//") || raw.includes("\\") || raw.includes("..")) return "/admin";
  return raw;
}

function AdminLoginForm() {
  const params = useSearchParams();
  const nextPath = adminNextPath(params.get("next"));
  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ marginBottom: 16 }}>관리자 로그인</h2>
      <p style={{ marginTop: 0, lineHeight: 1.5 }}>
        카카오 로그인 후 이 화면으로 돌아옵니다. 관리자로 등록된 계정만 승인·매장 관리를 할 수 있어요.
      </p>
      <a
        href={kakaoLoginUrl(nextPath)}
        style={{
          display: "inline-block",
          marginTop: 8,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#111827",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 800,
        }}
      >
        카카오로 로그인
      </a>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로그인 준비 중...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
