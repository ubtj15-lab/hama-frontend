"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  today: {
    card_views: number;
    saved_count: number;
    recent_views_count: number;
    naver_clicks: number;
    kakao_clicks: number;
    detail_actions: number;
    search_clicks: number;
    total_clicks: number;
  };
  total: {
    card_views: number;
    saved_count: number;
    recent_views_count: number;
    naver_clicks: number;
    kakao_clicks: number;
    detail_actions: number;
    search_clicks: number;
    total_clicks: number;
  };
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setErr(data.error || "통계를 불러오지 못했어요.");
          return;
        }
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setErr("통계를 불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cardStyle = {
    padding: 18,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  };

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: 24,
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
        background: "#f1f5f9",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>관리자 대시보드</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/admin/stores" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
            매장·매장주 연결
          </Link>
          <Link href="/admin/reservations" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
            예약 목록
          </Link>
          <a
            href="/partner"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}
          >
            매장주 대시보드
          </a>
          <Link href="/admin/login" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
            로그인
          </Link>
        </div>
      </div>

      {err && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            background: "#fee2e2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      {loading && (
        <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>통계 불러오는 중...</div>
      )}

      {!loading && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 오늘 요약 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>오늘 요약</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 14 }}>
              오늘 0시(한국시간) 기준
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {[
                { label: "카드 열람", value: stats.today.card_views, color: "#2563eb" },
                { label: "저장", value: stats.today.saved_count, color: "#16a34a" },
                { label: "최근 조회", value: stats.today.recent_views_count, color: "#7c3aed" },
                { label: "외부 클릭", value: stats.today.total_clicks, color: "#dc2626" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                    {item.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                상세 클릭 (오늘)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "네이버 링크", value: stats.today.naver_clicks, color: "#16a34a" },
                  { label: "카카오 링크", value: stats.today.kakao_clicks, color: "#ca8a04" },
                  { label: "길안내/예약 버튼", value: stats.today.detail_actions, color: "#2563eb" },
                  { label: "검색 추천 클릭", value: stats.today.search_clicks, color: "#7c3aed" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: row.color }}>{row.value}회</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 전체 요약 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>전체 누적</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {[
                { label: "카드 열람", value: stats.total.card_views, color: "#2563eb" },
                { label: "저장", value: stats.total.saved_count, color: "#16a34a" },
                { label: "최근 조회", value: stats.total.recent_views_count, color: "#7c3aed" },
                { label: "외부 클릭", value: stats.total.total_clicks, color: "#dc2626" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                    {item.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                상세 클릭 (전체)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "네이버 링크", value: stats.total.naver_clicks, color: "#16a34a" },
                  { label: "카카오 링크", value: stats.total.kakao_clicks, color: "#ca8a04" },
                  { label: "길안내/예약 버튼", value: stats.total.detail_actions, color: "#2563eb" },
                  { label: "검색 추천 클릭", value: stats.total.search_clicks, color: "#7c3aed" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: row.color }}>{row.value}회</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
