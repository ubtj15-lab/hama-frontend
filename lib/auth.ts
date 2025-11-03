// lib/auth.ts
export const ADMIN_COOKIE = "hama_admin";

// dev 용: 그냥 'ok' 넣고 7일 유지
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,        // 배포 시 true
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7일
};
