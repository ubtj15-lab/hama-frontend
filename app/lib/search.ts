// app/lib/search.ts
export async function searchPlace(query: string) {
  const res = await fetch("/api/search?" + new URLSearchParams({ query }), {
    method: "GET",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.documents ?? [];
}
