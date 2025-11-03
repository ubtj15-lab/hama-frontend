"use client";
import { useEffect, useRef, useState } from "react";

// 검색 결과 타입(백엔드 응답 필드명에 맞춤)
type Place = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string | null;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  openNow?: boolean;
};

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapPage() {
  const mapRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [query, setQuery] = useState("오산 카페");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  // Kakao 지도 스크립트 로드 + 지도 초기화
  useEffect(() => {
    // 이미 로드됐다면 스킵
    if (typeof window !== "undefined" && window.kakao && window.kakao.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APPKEY}&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => {
        initMap();
      });
    };
    document.head.appendChild(script);
  }, []);

  function initMap() {
    const container = document.getElementById("map");
    if (!container) return;

    const center = new window.kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
    const options = { center, level: 4 };
    mapRef.current = new window.kakao.maps.Map(container, options);
    infoRef.current = new window.kakao.maps.InfoWindow({ zIndex: 3 });
  }

  // 마커/인포윈도우 유틸
  function clearMarkers() {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }

  function panTo(lat: number, lng: number) {
    if (!mapRef.current) return;
    const pos = new window.kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(pos);
  }

  function openInfo(p: Place) {
    if (!mapRef.current || !window.kakao?.maps) return;

    const html = `
      <div style="padding:8px 10px;max-width:260px;font-size:13px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(p.name)}</div>
        <div style="color:#666;margin-bottom:6px;">${escapeHtml(p.address ?? "")}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          ${p.phone ? `<span style="color:#555;">${escapeHtml(p.phone)}</span>` : ""}
          ${typeof p.rating === "number" ? `<span>★ ${p.rating.toFixed(1)}</span>` : ""}
          ${typeof p.reviewCount === "number" ? `<span>(${p.reviewCount})</span>` : ""}
          ${p.openNow ? `<span style="color:#10b981;">영업중</span>` : ""}
        </div>
        <button id="fr-reserve-btn-${p.id}" style="
          background:#111;color:#fff;padding:7px 10px;border-radius:8px;cursor:pointer;
          font-size:13px; border:none;">30분 뒤 예약</button>
      </div>
    `;

    const pos = new window.kakao.maps.LatLng(p.lat!, p.lng!);
    infoRef.current.setContent(html);
    infoRef.current.setPosition(pos);
    infoRef.current.open(mapRef.current);

    // 버튼 이벤트 부착
    setTimeout(() => {
      const btn = document.getElementById(`fr-reserve-btn-${p.id}`);
      if (btn) {
        btn.addEventListener("click", async () => {
          try {
            const when = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            const payload = {
              placeId: p.id,
              placeName: p.name,
              address: p.address,
              lat: p.lat,
              lng: p.lng,
              phone: p.phone ?? null,
              user: { id: "tester-001", name: "Internal Tester" },
              when,
            };
            const res = await fetch("/api/reservations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
              alert(`예약 실패: ${data?.error ?? res.status}`);
              return;
            }
            alert(`예약 완료! \n${p.name}\n${new Date(when).toLocaleString()}`);
          } catch (e: any) {
            alert(`예약 오류: ${e?.message ?? "Unknown"}`);
          }
        });
      }
    }, 0);
  }

  function drawMarkers(items: Place[]) {
    if (!mapRef.current || !window.kakao?.maps) return;
    clearMarkers();

    items.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;

      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(p.lat, p.lng),
      });
      markersRef.current.push(marker);

      window.kakao.maps.event.addListener(marker, "click", () => {
        openInfo(p);
      });
    });

    // 첫 결과로 지도 이동
    const first = items.find((it) => typeof it.lat === "number" && typeof it.lng === "number");
    if (first) panTo(first.lat!, first.lng!);
  }

  // 검색
  async function handleSearch() {
    if (!query.trim()) return;
    try {
      setLoading(true);
      const r = await fetch(`/api/places/search?query=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await r.json();
      const items: Place[] = Array.isArray(data?.results) ? data.results : [];
      setResults(items);
      drawMarkers(items);
    } catch (e) {
      console.error(e);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-4" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
      <section style={{ gridColumn: "1 / span 2" }}>
        <h1 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>🗺️ FreeReserve 지도 + 검색 + 예약</h1>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="예) 오산 카페 / 강남 설렁탕"
            style={{ flex: 1, height: 40, padding: "0 12px", border: "1px solid #ddd", borderRadius: 8 }}
          />
          <button
            onClick={handleSearch}
            style={{ height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff" }}
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>
      </section>

      <div id="map" style={{ width: "100%", height: 560, borderRadius: 12, border: "1px solid #eee", gridColumn: "1 / 2" }} />

      <aside style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, overflowY: "auto", height: 560 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>결과 {results.length}건</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (typeof p.lat === "number" && typeof p.lng === "number") {
                  panTo(p.lat, p.lng);
                  openInfo(p);
                } else {
                  alert("좌표 정보가 없는 장소입니다.");
                }
              }}
              style={{
                textAlign: "left",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: "10px 12px",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>{p.address}</div>
              <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
                {typeof p.rating === "number" && <span>★ {p.rating.toFixed(1)}</span>}
                {typeof p.reviewCount === "number" && <span>({p.reviewCount})</span>}
                {p.openNow && <span style={{ color: "#10b981" }}>영업중</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}

// XSS 방어용 간단 이스케이프
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
