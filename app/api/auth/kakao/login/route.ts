// app/api/auth/kakao/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const REST_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;

  if (!REST_KEY || !REDIRECT_URI) {
    return new Response("Kakao env not set", { status: 500 });
  }

  const kakaoAuthUrl =
    "https://kauth.kakao.com/oauth/authorize?" +
    new URLSearchParams({
      client_id: REST_KEY,          // ★ 반드시 REST API 키
      redirect_uri: REDIRECT_URI,   // ★ 위 환경변수와 동일
      response_type: "code",
    }).toString();

  return NextResponse.redirect(kakaoAuthUrl);
}
