const RETURN_BASE = "http://hama.invalid";
const MAX_RETURN_PATH_LENGTH = 512;

function decodeLayer(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** 같은 출처의 상대 경로만 그대로 둔다. 그 외에는 "/"를 반환한다. */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  let current = raw.trim();
  if (!current || current.length > MAX_RETURN_PATH_LENGTH) return "/";

  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeLayer(current);
    if (decoded === null || decoded.length > MAX_RETURN_PATH_LENGTH) return "/";
    if (decoded === current) break;
    current = decoded;
  }

  if (!current.startsWith("/")) return "/";
  if (current.startsWith("//") || current.startsWith("/\\")) return "/";
  if (current.includes("\\") || current.includes("@")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(current)) return "/";

  let url: URL;
  try {
    url = new URL(current, RETURN_BASE);
  } catch {
    return "/";
  }

  if (url.origin !== RETURN_BASE || url.username || url.password) return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  if (path.length > MAX_RETURN_PATH_LENGTH) return "/";
  return path;
}
