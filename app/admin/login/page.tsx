"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hama.local");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      setErr(data.error || "로그인 실패");
      return;
    }
    router.replace("/admin/reservations");
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ marginBottom: 16 }}>관리자 로그인</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          이메일
          <input value={email} onChange={e => setEmail(e.target.value)} className="border p-2 w-full" />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 w-full" />
        </label>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
        <button type="submit" className="border p-2">로그인</button>
      </form>
    </div>
  );
}
