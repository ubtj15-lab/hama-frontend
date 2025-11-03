// OSRM geojson 경로를 카카오 지도에 그리기 + 단계 텍스트 만들기
// 주의: page.tsx에서 맵을 만들 때 window.__HAMA_MAP = mapInstance; 로 저장해 주세요.

type OSRMGeometry = {
  type: "LineString";
  coordinates: number[][]; // [lng, lat][]
};

type OSRMStep = {
  distance?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
};

declare global {
  interface Window {
    kakao: any;
    __HAMA_MAP?: any;
  }
}

// 간단 단계 텍스트
export function stepText(step: OSRMStep) {
  const t = step?.maneuver?.type || "";
  const m = step?.maneuver?.modifier || "";
  const name = step?.name ? ` (${step.name})` : "";
  const dist = step?.distance ? ` – 약 ${Math.round(step.distance)}m` : "";
  return [t, m].filter(Boolean).join(" ") + name + dist;
}

// 경로 그리기
export function drawRoute(geometry: OSRMGeometry, steps: OSRMStep[] = []) {
  const map = window.__HAMA_MAP;
  const kakao = window.kakao;
  if (!map || !kakao || !geometry?.coordinates?.length) return;

  const path = geometry.coordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));

  // 기존 폴리라인 제거(여러 번 그려지지 않게)
  (map.__routePolylines || []).forEach((pl: any) => pl.setMap(null));
  map.__routePolylines = [];

  const polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 5,
    strokeColor: "#3b82f6",
    strokeOpacity: 0.9,
    strokeStyle: "solid",
  });
  polyline.setMap(map);
  map.__routePolylines.push(polyline);

  // 보기 좋은 범위로 이동
  const bounds = new kakao.maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));
  map.setBounds(bounds);

  // 필요하면 단계 마커도…(옵션)
  // steps.forEach(s => { ... });
}
