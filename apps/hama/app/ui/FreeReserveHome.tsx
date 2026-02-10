"use client";
import React, { useState, useCallback } from "react";
import axios from "axios";

type Place = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  openNow?: boolean | null;
};

export default function FreeReserveHome() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Place[]>([]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    try {
      setLoading(true);
      setError(null);

      // 프론트 프록시로 호출 → 백엔드로 전달됨
      const { data } = await axios.get("/api/places/search", { params: { query: q } });

      // 응답 형태가 배열 또는 {results: []} 둘 다 처리
      const rows: any[] = Array.isArray(data) ? data : data.results ?? [];
      const mapped: Place[] = rows.map((r) => ({
        id: r.id ?? r.place_id ?? String(Math.random()),
        name: r.name,
        address: r.address ?? r.formatted_address ?? "",
        lat: r.lat ?? r.geometry?.location?.lat,
        lng: r.lng ?? r.geometry?.location?.lng,
        phone: r.phone ?? r.formatted_phone_number,
        rating: r.rating,
        reviewCount: r.reviewCount ?? r.user_ratings_total,
        categories: r.categories ?? r.types ?? [],
        openNow: r.openNow ?? r.opening_hours?.open_now ?? null,
      }));

      setResults(mapped);
    } catch (e: any) {
      console.error("[search error]", e?.response?.data || e?.message || e);
      setError(e?.response?.data?.error || e?.message || "검색 중 오류가 발생했습니다.");
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">FreeReserve × HAMA</h1>
        <p className="text-sm text-gray-500 mb-6">음성으로 찾고, 한 번에 예약까지</p>

        {/* 검색바 */}
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 px-4 py-3 rounded-xl border bg-white"
            placeholder="예) 오산 카페 / 강남 설렁탕 / MRI 병원"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-3 rounded-xl bg-black text-white hover:bg-gray-800"
          >
            검색
          </button>
        </div>

        {/* 상태 표시 */}
        {loading && <div className="rounded-xl p-4 bg-white shadow mb-3">검색 중…</div>}
        {error && <div className="rounded-xl p-4 bg-white shadow mb-3 text-red-600">{error}</div>}

        {/* 결과 리스트 */}
        {results.length === 0 && !loading ? (
          <div className="rounded-xl p-6 bg-white shadow text-gray-500">
            검색 결과가 여기에 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.id} className="rounded-xl p-4 bg-white shadow border">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">{r.name}</div>
                  {typeof r.rating === "number" && (
                    <div className="text-sm">⭐ {r.rating.toFixed(1)} ({r.reviewCount ?? 0})</div>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">{r.address}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {r.openNow === true ? "영업중" : r.openNow === false ? "영업 종료" : "영업 정보 없음"}
                  {r.phone ? ` · ${r.phone}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
