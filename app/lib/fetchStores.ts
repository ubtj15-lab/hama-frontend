// app/lib/fetchStores.ts
import { supabase } from "@lib/supabaseClient";
import type { StoreRecord, HomeCard } from "@lib/storeTypes";
import { storeToHomeCard } from "@/lib/storeMappers";

export async function fetchStores(): Promise<HomeCard[]> {
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id,name,category,area,address,lat,lng,phone,image_url,distance_hint,is_active,mood,with_kids,for_work,price_level,tags"
    )
    .eq("is_active", true)
    .limit(500);

  if (error || !data) {
    console.error("fetchStores error:", error);
    return [];
  }

  const rows = data as StoreRecord[];
  return rows.map((s) => storeToHomeCard(s));
}

export const mapStoreToHomeCard = storeToHomeCard;
