// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

const FRONT_BASE =
  process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // code 체크는 최소한만 하고, 일단 로그인 성공 플래그만 넘겨주자
  if (!code) {
    const errorUrl = new URL("/", FRONT_BASE);
    errorUrl.searchParams.set("kakao_login", "error");
    return NextResponse.redirect(errorUrl);
  }

  // 여기서 실제 토큰 교환/유저 조회는 나중에 하고,
  // 지금은 "로그인 성공" 표시만 프론트로 넘긴다.
  const redirectUrl = new URL("/", FRONT_BASE);
  redirectUrl.searchParams.set("kakao_login", "success");
  // 필요하면 닉네임도 쿼리로 넘길 수 있음
  // redirectUrl.searchParams.set("nickname", "카카오 사용자");

  return NextResponse.redirect(redirectUrl);
}
