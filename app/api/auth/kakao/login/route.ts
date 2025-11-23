import { NextResponse } from "next/server";

export async function GET() {
  const REST_KEY = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;

  const kakaoAuthURL =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${REST_KEY}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI!)}` +
    `&response_type=code`;

  return NextResponse.redirect(kakaoAuthURL);
}
