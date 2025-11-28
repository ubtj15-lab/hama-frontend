// lib/getUser.ts
export function getUser() {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find(row => row.startsWith("hama_user="));

  if (!cookie) return null;

  try {
    return JSON.parse(cookie.replace("hama_user=", ""));
  } catch (e) {
    return null;
  }
}
