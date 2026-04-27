import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type Store = {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  image_url?: string | null;
  mood?: string[] | null;
  tags?: string[] | null;
  updated_at?: string | null;
};

const OSAN_CITY_HALL = { lat: 37.1498, lng: 127.0772 };
const DONGTAN_STATION = { lat: 37.2009, lng: 127.0957 };
const RADIUS_KM = 5;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scoreStore(s: Store): number {
  let score = 0;
  const hasImage = Boolean(s.image_url);
  const tagCount = Array.isArray(s.tags) ? s.tags.length : 0;
  const moodCount = Array.isArray(s.mood) ? s.mood.length : 0;
  score += hasImage ? 5 : 0;
  score += Math.min(tagCount, 5);
  score += Math.min(moodCount, 3);
  if (s.updated_at) score += 2;
  return score;
}

function categoryOk(c: string | null): boolean {
  const x = String(c ?? "").toLowerCase();
  return x === "restaurant" || x === "cafe" || x === "salon" || x === "beauty";
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 50;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Math.max(30, Math.min(50, Number(args[++i] || "50")));
  }
  return { limit };
}

async function main() {
  const { limit } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,category,area,address,lat,lng,image_url,mood,tags,updated_at")
    .not("name", "is", null)
    .neq("name", "")
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Store[];

  const scoped = rows
    .filter((s) => categoryOk(s.category))
    .map((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return { s, near: false, dist: Infinity };
      const d1 = haversineKm(OSAN_CITY_HALL, { lat: s.lat, lng: s.lng });
      const d2 = haversineKm(DONGTAN_STATION, { lat: s.lat, lng: s.lng });
      const d = Math.min(d1, d2);
      return { s, near: d <= RADIUS_KM, dist: d };
    })
    .filter((x) => x.near)
    .sort((a, b) => (scoreStore(b.s) - scoreStore(a.s)) || (a.dist - b.dist))
    .slice(0, limit);

  console.log("=== priority stores ===");
  console.log(`pool total: ${rows.length}`);
  console.log(`near osan/dongtan <= ${RADIUS_KM}km: ${scoped.length}`);
  console.table(
    scoped.map((x, idx) => ({
      rank: idx + 1,
      id: x.s.id,
      name: x.s.name,
      category: x.s.category,
      area: x.s.area,
      dist_km: Number.isFinite(x.dist) ? Number(x.dist.toFixed(2)) : null,
      score: scoreStore(x.s),
    }))
  );
}

void main().catch((e) => {
  console.error("[select:priority-stores] fatal:", e?.message ?? e);
  process.exit(1);
});
