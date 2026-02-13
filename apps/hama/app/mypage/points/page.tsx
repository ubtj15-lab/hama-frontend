"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HamaUser {
  nickname: string;
  points: number;
}

interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: string; // ISO
}

const USER_KEY = "hamaUser";
const LOG_KEY = "hamaPointLogs";

function loadUser(): HamaUser {
  if (typeof window === "undefined") return { nickname: "게스트", points: 0 };
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { nickname: "게스트", points: 0 };
    const parsed = JSON.parse(raw);
    return {
      nickname: parsed.nickname ?? "게스트",
      points: typeof parsed.points === "number" ? parsed.points : 0,
    };
  } catch {
    return { nickname: "게스트", points: 0 };
  }
}

function loadLogs(): PointLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PointLog[];
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function PointHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<HamaUser>({ nickname: "게스트", points: 0 });
  const [logs, setLogs] = useState<PointLog[]>([]);

  useEffect(() => {
    setUser(loadUser());
    setLogs(loadLogs());
  }, []);

  const handleClearLogs = () => {
    if (typeof window === "undefined") return;
    if (!confirm("포인트 내역을 모두 삭제할까요? (포인트 자체는 유지됩니다)")) {
      return;
    }
    window.localStorage.removeItem(LOG_KEY);
    setLogs([]);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e9f2fb",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          padding: "24px 16px 40px",
          boxSizing: "border-box",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        {/* 상단 헤더 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 10px",
              background: "#ffffff",
              boxShadow: "0 4px 10px rgba(15,23,42,0.15)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ← 뒤로
          </button>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            포인트 히스토리
          </h1>
          <div style={{ width: 52 }} /> {/* 오른쪽 균형용 빈 박스 */}
        </header>

        {/* 유저 포인트 박스 */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: "14px 16px",
            boxShadow: "0 8px 20px rgba(15,23,42,0.15)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            {user.nickname || "게스트"} 님의 현재 포인트
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 8,
            }}
          >
            {user.points.toLocaleString()} P
          </div>
          <button
            type="button"
            onClick={handleClearLogs}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              background: "#f3f4f6",
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            내역 비우기
          </button>
        </section>

        {/* 내역 리스트 */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: "10px 0",
            boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                fontSize: 13,
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              아직 적립된 포인트 내역이 없어요.
              <br />
              검색하거나 음성으로 찾아보면 포인트가 쌓여요 😊
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {logs.map((log) => (
                <li
                  key={log.id}
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                        marginBottom: 4,
                      }}
                    >
                      {log.reason}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                      }}
                    >
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: log.amount >= 0 ? "#16a34a" : "#b91c1c",
                    }}
                  >
                    {log.amount >= 0 ? "+" : ""}
                    {log.amount} P
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
