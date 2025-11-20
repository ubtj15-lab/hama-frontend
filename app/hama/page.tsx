"use client";

import React, { useState } from "react";
import stores from "../../data/stores.json";

// 매장 타입
type Store = {
  id: string;
  name: string;
  category: "cafe" | "restaurant" | "beauty";
  lat: number;
  lng: number;
  image: string;
  intro: string;
  rating: number;
  address: string;
};

// ====== (예전에 쓰던 카테고리 맵/헬퍼들, 필요하면 이어서 쓸 수 있게 남겨둠) ======
const CATEGORY_MAP: Record<string, string> = {
  카페: "CE7",
  편의점: "CS2",
  음식점: "FD6",
  식당: "FD6",
  약국: "PM9",
  주차장: "PK6",
  병원: "HP8",
  마트: "MT1",
};

function inferCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const k of Object.keys(CATEGORY_MAP)) {
    if (t.includes(k.toLowerCase())) return CATEGORY_MAP[k];
  }
  return undefined;
}

// kakao SDK 쓰던 부분 계속 쓸 수 있게 선언만 남겨둠 (안 쓰면 그냥 무시됨)
declare const kakao: any;

// ==================== 메인 컴포넌트 ====================
export default function HamaPage() {
  const allStores = stores as Store[];

  // 카테고리별 배열
  const cafes = allStores.filter((s) => s.category === "cafe");
  const restaurants = allStores.filter((s) => s.category === "restaurant");
  const beauties = allStores.filter((s) => s.category === "beauty");

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-6">
      {/* 상단 헤더 / 타이틀 */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HAMA 베타</h1>
          <p className="text-sm text-slate-600 mt-1">
            오산 근처 카페 · 식당 · 미용실을 하마가 추천해 드려요.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-1 rounded-full bg-white shadow">
            베타 테스트 v0.9
          </span>
        </div>
      </header>

      {/* (나중에 음성 검색/하마 캐릭터 영역 넣을 자리) */}
      <section className="mb-6">
        <div className="w-full rounded-3xl bg-white shadow p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500 mb-1">음성/텍스트 검색</div>
            <div className="text-base font-semibold text-slate-800">
              “근처 카페 추천해줘”, “애랑 갈만한 식당 있어?”
            </div>
          </div>
          <button className="rounded-full px-4 py-2 text-sm font-semibold bg-sky-500 text-white shadow">
            마이크 (준비 중)
          </button>
        </div>
      </section>

      {/* 카테고리별 섹션 */}
      <section className="space-y-8">
        <CategorySection
          title="카페"
          subtitle="브런치 · 디저트 · 분위기 좋은 카페"
          items={cafes}
          onSelect={setSelectedStore}
        />
        <CategorySection
          title="미용실"
          subtitle="커트 · 펌 · 염색 예약 가능 미용실"
          items={beauties}
          onSelect={setSelectedStore}
        />
        <CategorySection
          title="식당"
          subtitle="가족 외식 · 점심 식사 · 술자리"
          items={restaurants}
          onSelect={setSelectedStore}
        />
      </section>

      {/* (선택된 매장 있는 경우) 디테일 플로우 자리 - 지금은 베타라 간단 안내만 */}
      {selectedStore && (
        <section className="mt-8">
          <div className="rounded-3xl bg-white shadow p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {selectedStore.name} 상세 (베타)
              </h2>
              <button
                className="text-xs text-slate-500 underline"
                onClick={() => setSelectedStore(null)}
              >
                닫기
              </button>
            </div>
            <p className="text-sm text-slate-700 mb-2">
              {selectedStore.intro}
            </p>
            <p className="text-xs text-slate-500 mb-1">
              주소: {selectedStore.address}
            </p>
            <p className="text-xs text-slate-500 mb-3">
              위도/경도: {selectedStore.lat}, {selectedStore.lng}
            </p>
            <button className="mt-1 w-full rounded-xl bg-sky-500 text-white text-sm py-2 font-semibold">
              예약하기 (베타에서는 동선 테스트용 더미 버튼)
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

// ==================== 서브 컴포넌트들 ====================

type CategorySectionProps = {
  title: string;
  subtitle?: string;
  items: Store[];
  onSelect: (store: Store) => void;
};

function CategorySection({ title, subtitle, items, onSelect }: CategorySectionProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-12">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className="relative w-[260px] h-[200px] rounded-3xl overflow-hidden shadow-lg bg-slate-200 text-left"
          >
            <img
              src={s.image}
              alt={s.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white text-sm">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-slate-200 mt-0.5 line-clamp-1">
                {title} · {s.intro}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
