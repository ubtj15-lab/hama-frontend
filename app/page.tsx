'use client';

import { useEffect, useRef, useCallback } from 'react';
import MicButton from './components/MicButton';

declare global {
  interface Window { kakao: any; }
}

const KAKAO_SDK_URL =
  `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`;

// Kakao JS SDK 로더
function loadKakao(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    if ((window as any).kakao?.maps) return resolve((window as any).kakao);

    const s = document.createElement('script');
    s.src = KAKAO_SDK_URL;
    s.async = true;
    s.onload = () => (window as any).kakao.maps.load(() => resolve((window as any).kakao));
    s.onerror = () => reject(new Error('Kakao SDK load failed'));
    document.head.appendChild(s);
  });
}

// 서버 프록시로 키워드 검색 (REST 키는 서버에서만 사용)
async function searchKeyword(keyword: string) {
  const res = await fetch(`/api/kakao/search?query=${encodeURIComponent(keyword)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.documents ?? [];
}

export default function Page() {
  const mapRef = useRef<any>(null);
  const lastPlaceRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    loadKakao()
      .then((kakao) => {
        if (!mounted) return;
        const el = document.getElementById('map') as HTMLElement;
        const map = new kakao.maps.Map(el, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 3,
        });
        mapRef.current = map;

        // 반쪽 지도 방지
        setTimeout(() => map.relayout(), 0);
        const onResize = () => map.relayout();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      })
      .catch(console.error);

    return () => { mounted = false; };
  }, []);

  // 외부 카카오맵 길찾기 열기
  const openRouteTo = (place: any) => {
    const url =
      `https://map.kakao.com/?sName=${encodeURIComponent('현재위치')}` +
      `&eName=${encodeURIComponent(place.place_name)}` +
      `&eX=${encodeURIComponent(place.x)}` +
      `&eY=${encodeURIComponent(place.y)}`;
    window.open(url, '_blank');
  };

  // Mic 결과 처리
  const handleResult = useCallback(async (text: string) => {
    const kakao = (window as any).kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;

    const t = text.trim();

    // 확대/축소 음성 명령
    if (t.includes('줌 아웃') || t.includes('축소')) { map.setLevel(map.getLevel() + 1); return; }
    if (t.includes('줌 인') || t.includes('확대'))  { map.setLevel(Math.max(1, map.getLevel() - 1)); return; }

    // 길안내/안내 시작
    if (t.includes('길안내') || t.includes('안내 시작')) {
      if (lastPlaceRef.current) openRouteTo(lastPlaceRef.current);
      else alert('먼저 목적지를 말해줘 (예: "서울역")');
      return;
    }

    // 키워드 검색 (서버 프록시 사용)
    const docs = await searchKeyword(t);
    if (!docs.length) { alert(`검색 결과 없음: ${t}`); return; }

    const first = docs[0];          // { place_name, x, y, ... }
    lastPlaceRef.current = first;

    const pos = new kakao.maps.LatLng(first.y, first.x);
    map.setCenter(pos);
    const marker = new kakao.maps.Marker({ position: pos });
    marker.setMap(map);
  }, []);

  return (
    <>
      <div id="map" style={{ width: '100vw', height: '100vh' }} />
      <MicButton onResult={handleResult} />
      <style jsx global>{`
        html, body { margin: 0; padding: 0; height: 100%; }
      `}</style>
    </>
  );
}
