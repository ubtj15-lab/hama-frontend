// app/api/stores/route.ts

import { NextResponse } from "next/server";
import type { StoreRecord } from "@/lib/storeTypes";

type ApiStoreItem = StoreRecord & {
  distance_hint?: string;
};

const DUMMY_STORES: ApiStoreItem[] = [
  {
    id: "store-1",
    name: "스타벅스 오산점",
    category: "cafe",
    area: "오산",
    address: "경기 오산시 ...",
    lat: null,
    lng: null,
    phone: null,
    image_url: null,
    kakao_place_url: null,
    naver_place_id: null,
    mood: [],
    tags: [],
    with_kids: null,
    for_work: null,
    reservation_required: null,
    price_level: null,
    updated_at: null,
    distance_hint: "",
  },
];

export async function GET() {
  return NextResponse.json({ items: DUMMY_STORES });
}
