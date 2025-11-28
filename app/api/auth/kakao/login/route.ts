// app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // 🔹 환경변수는 요청이 들어올 때마다 바로 읽자
  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;

  // 🔍 디버깅용: 뭐가 없는지 확인
  if (!REST_API_KEY || !REDIRECT_URI) {
    const msg = `Kakao env not set: REST_API_KEY=${
      REST_API_KEY ? "OK" : "MISSING"
    }, REDIRECT_URI=${REDIRECT_URI ? "OK" : "MISSING"}`;
    console.error(msg);
    return new NextResponse(msg, { status: 500 });
  }

  const kakaoUrl =
    "https://kauth.kakao.com/oauth/authorize" +
    `?client_id=${REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code`;

  return NextResponse.redirect(kakaoUrl);
}
