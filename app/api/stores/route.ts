// app/api/stores/route.ts

import { NextResponse } from "next/server";
import type { StoreRecord } from "@lib/storeTypes";

const DUMMY_STORES: StoreRecord[] = [
  {
    id: "store-1",
    name: "스타벅스 오산점",
    category: "cafe",
    area: "오산",            // ✅ 추가
    address: "경기 오산시 ...",
    lat: null,
    lng: null,
    phone: null,            // ✅ 추가 (모르면 null)
    image_url: "",
    distance_hint: "",
    is_active: true,
    mood: null,
    with_kids: null,
    for_work: null,
    price_level: null,
    tags: [],
  },
  // 다른 더미들도 동일하게 area, phone 넣기
];

export async function GET() {
  return NextResponse.json({ items: DUMMY_STORES });
}
