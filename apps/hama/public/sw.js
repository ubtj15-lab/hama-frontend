/* HAMA PWA — Next.js dev/HMR·정적 청크는 SW가 가로채지 않음 (layout.css 404·manifest 실패 방지) */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const path = url.pathname;

  // 이 경로들은 respondWith 하지 않음 → 브라우저 기본 fetch (SW 캐시/실패 전파 없음)
  if (
    path.startsWith("/_next/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path.startsWith("/__nextjs")
  ) {
    return;
  }

  event.respondWith(fetch(request));
});
