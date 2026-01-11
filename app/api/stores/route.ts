// app/api/stores/route.ts
import { NextResponse } from "next/server";
import type { StoreRecord } from "@/lib/storeTypes";

// 지금은 Supabase 대신 더미 데이터로 시작
const DUMMY_STORES: StoreRecord[] = [
  {
    id: "store-1",
    name: "스타벅스 오산점",
    category: "카페",
    lat: null,
    lng: null,
    address: "경기 오산시 어딘가 123",
    distance_hint: "조용한 분위기",
    image_url: "/images/sample-cafe-1.jpg",
    is_active: true,
  },
  {
    id: "store-2",
    name: "라운지 83",
    category: "브런치 · 카페",
    lat: null,
    lng: null,
    address: "오산 브런치 거리 83",
    distance_hint: "햇살 잘 들어오는 브런치",
    image_url: "/images/sample-cafe-2.jpg",
    is_active: true,
  },
  {
    id: "store-3",
    name: "하마키즈 플레이룸",
    category: "키즈카페",
    lat: null,
    lng: null,
    address: "오산 패밀리타운 3층",
    distance_hint: "아이와 함께 놀기 좋은 곳",
    image_url: "/images/sample-kids-1.jpg",
    is_active: true,
  },
  {
    id: "store-4",
    name: "소담소담 한식당",
    category: "한식 · 식당",
    lat: null,
    lng: null,
    address: "오산 맛집거리 21",
    distance_hint: "가족 외식하기 좋은 밥집",
    image_url: "/images/sample-dining-1.jpg",
    is_active: true,
  },
  {
    id: "store-5",
    name: "슈가웨이브 디저트바",
    category: "디저트 · 카페",
    lat: null,
    lng: null,
    address: "오산 달달로 5",
    distance_hint: "달달한 하루 마무리",
    image_url: "/images/sample-dessert-1.jpg",
    is_active: true,
  },
];

export async function GET() {
  // 나중에 여기서 Supabase에서 SELECT 해오면 됨
  return NextResponse.json(DUMMY_STORES);
}
