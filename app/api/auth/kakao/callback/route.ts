// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // 1) code 없으면 에러로 홈으로 돌려보내기
  if (!code) {
    const errorUrl = new URL("/", url.origin);
    errorUrl.searchParams.set("kakao_error", "no_code");
    return NextResponse.redirect(errorUrl);
  }

  // 2) 베타 버전에서는 토큰 요청/유저 조회 생략
  //    → 그냥 "로그인 성공" 플래그만 프론트에 전달
  const successUrl = new URL("/", url.origin);
  successUrl.searchParams.set("kakao_login", "success");

  return NextResponse.redirect(successUrl);
}
