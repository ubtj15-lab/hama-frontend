// app/lib/directions.ts
export type LatLng = { lat: number; lng: number };

export async function getDirections(origin: LatLng, destination: LatLng) {
  const o = `${origin.lng},${origin.lat}`;       // lng,lat
  const d = `${destination.lng},${destination.lat}`;
  const res = await fetch(`/api/directions?origin=${o}&destination=${d}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("directions failed");
  return res.json() as Promise<{
    path: [number, number][], // [lat,lng]
    summary: { distance?: number; duration?: number } | null
  }>;
}
