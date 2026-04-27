"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TestInput = {
  companions: "가족" | "혼자" | "친구" | "연인" | "동료";
  dietary: "채식" | "할랄" | "없음";
  interests: Array<"액티비티" | "만화카페/보드게임카페" | "영화/공연" | "전시/박물관">;
  gender: "남성" | "여성" | "선택 안 함";
  category: "food" | "cafe" | "beauty" | "activity" | "course";
  time: "점심" | "저녁" | "오후";
  locationPreset: "osan_city_hall" | "dongtan_station" | "my_location";
  userLat?: number | null;
  userLng?: number | null;
};

type ResultStore = {
  rank: number;
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  mood: string[];
  tags: string[];
  reason: string;
  score: number;
  breakdown: Record<string, string | number | null>;
  capability: Record<string, boolean | number | null>;
};

type ApiResult = {
  totalCandidates: number;
  stores: ResultStore[];
  error?: string;
};

const INTEREST_OPTIONS: TestInput["interests"] = [
  "액티비티",
  "만화카페/보드게임카페",
  "영화/공연",
  "전시/박물관",
];

const DEFAULT_INPUT: TestInput = {
  companions: "가족",
  dietary: "없음",
  interests: [],
  gender: "선택 안 함",
  category: "food",
  time: "저녁",
  locationPreset: "osan_city_hall",
  userLat: null,
  userLng: null,
};

export default function AdminRecommendTestPage() {
  const [input, setInput] = useState<TestInput>(DEFAULT_INPUT);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);

  const canUseMyLoc = input.locationPreset === "my_location";
  const scoreKeys = useMemo(
    () => [
      "finalScore",
      "scenarioRichScore",
      "scenarioScore",
      "distanceScore",
      "businessScore",
      "qualityScore",
      "convenienceScore",
      "personalizationScore",
      "behaviorBoostPillar",
      "behaviorVisibility",
      "activeScenario",
    ],
    []
  );

  const setField = <K extends keyof TestInput>(key: K, value: TestInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest: TestInput["interests"][number]) => {
    setInput((prev) => {
      const has = prev.interests.includes(interest);
      return {
        ...prev,
        interests: has ? prev.interests.filter((x) => x !== interest) : [...prev.interests, interest],
      };
    });
  };

  const getMyLocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMsg("브라우저 위치 접근을 사용할 수 없습니다.");
      return;
    }
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInput((prev) => ({
          ...prev,
          locationPreset: "my_location",
          userLat: pos.coords.latitude,
          userLng: pos.coords.longitude,
        }));
        setMsg("내 위치를 반영했습니다.");
      },
      () => setMsg("위치 권한이 없거나 위치를 가져오지 못했습니다."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const run = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/recommend-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as ApiResult;
      if (!res.ok || json.error) {
        setMsg(json.error ?? "추천 테스트 실패");
        setResult(null);
      } else {
        setResult(json);
      }
    } catch {
      setMsg("추천 테스트 요청 중 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "Noto Sans KR, system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>추천 엔진 시나리오 테스트</h1>
        <Link href="/admin" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 800 }}>
          관리자 홈
        </Link>
      </div>

      <section style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 14, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            companions
            <select value={input.companions} onChange={(e) => setField("companions", e.target.value as TestInput["companions"])}>
              <option value="가족">가족</option>
              <option value="혼자">혼자</option>
              <option value="친구">친구</option>
              <option value="연인">연인</option>
              <option value="동료">동료</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            dietary
            <select value={input.dietary} onChange={(e) => setField("dietary", e.target.value as TestInput["dietary"])}>
              <option value="없음">없음</option>
              <option value="채식">채식</option>
              <option value="할랄">할랄</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            gender
            <select value={input.gender} onChange={(e) => setField("gender", e.target.value as TestInput["gender"])}>
              <option value="선택 안 함">선택안함</option>
              <option value="남성">남성</option>
              <option value="여성">여성</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            category
            <select value={input.category} onChange={(e) => setField("category", e.target.value as TestInput["category"])}>
              <option value="food">food</option>
              <option value="cafe">cafe</option>
              <option value="beauty">beauty</option>
              <option value="activity">activity</option>
              <option value="course">course</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            time
            <select value={input.time} onChange={(e) => setField("time", e.target.value as TestInput["time"])}>
              <option value="점심">점심</option>
              <option value="저녁">저녁</option>
              <option value="오후">오후</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            위치
            <select value={input.locationPreset} onChange={(e) => setField("locationPreset", e.target.value as TestInput["locationPreset"])}>
              <option value="osan_city_hall">오산 시청</option>
              <option value="dongtan_station">동탄역</option>
              <option value="my_location">내 위치</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {INTEREST_OPTIONS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => toggleInterest(x)}
              style={{
                border: "1px solid #CBD5E1",
                borderRadius: 999,
                padding: "6px 10px",
                background: input.interests.includes(x) ? "#DBEAFE" : "#fff",
                color: input.interests.includes(x) ? "#1D4ED8" : "#334155",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {x}
            </button>
          ))}
        </div>

        {canUseMyLoc ? (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={getMyLocation}
              style={{ border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}
            >
              내 위치 가져오기
            </button>
            <span style={{ marginLeft: 8, fontSize: 12, color: "#64748B" }}>
              lat: {input.userLat ?? "-"}, lng: {input.userLng ?? "-"}
            </span>
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            style={{ border: "none", borderRadius: 10, background: "#111827", color: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            {loading ? "추천 계산 중..." : "추천 받기"}
          </button>
        </div>
      </section>

      {msg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>{msg}</div>
      ) : null}

      {result ? (
        <>
          <div style={{ marginBottom: 10, color: "#334155", fontWeight: 700 }}>후보 매장 수: {result.totalCandidates}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {result.stores.map((s) => (
              <article key={s.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {s.rank}순위 · {s.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>category: {s.category ?? "-"}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#0F172A" }}>{s.reason}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#EA580C" }}>{s.score.toFixed(2)}</div>
                </div>

                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={`${s.name} 사진`}
                    style={{ marginTop: 8, width: "100%", maxWidth: 320, borderRadius: 10, border: "1px solid #E2E8F0", objectFit: "cover" }}
                  />
                ) : null}

                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>점수 분해</div>
                    <div style={{ fontSize: 12, color: "#1F2937", lineHeight: 1.5 }}>
                      {scoreKeys.map((k) => (
                        <div key={k}>
                          {k}: {String(s.breakdown[k] ?? "-")}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>capability</div>
                    <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(s.capability, null, 2)}</pre>
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: "#334155" }}>
                  mood: {(s.mood ?? []).join(", ") || "-"} / tags: {(s.tags ?? []).join(", ") || "-"}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
