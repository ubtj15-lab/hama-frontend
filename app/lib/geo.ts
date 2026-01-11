// app/lib/geo.ts
export function calcDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number | null,
  lng2: number | null
) {
  if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;

  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}
