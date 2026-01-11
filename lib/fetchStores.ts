import { supabase } from "@/lib/supabaseClient";
import { StoreRecord, HomeCard, mapStoreToHomeCard } from "./storeTypes";

export async function fetchStores(): Promise<HomeCard[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("❌ fetchStores 오류:", error);
    return [];
  }

  if (!data) return [];

  return data.map((store: StoreRecord) =>
    mapStoreToHomeCard(store, store.distance_hint || 1.0)
  );
}
