// app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const REST_API_KEY = process.env.KAKAO_REST_API_KEY!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!;

export async function GET(req: NextRequest) {
  if (!REST_API_KEY || !REDIRECT_URI) {
    console.error("Kakao env missing", { REST_API_KEY, REDIRECT_URI });
    return new NextResponse("Kakao env not set", { status: 500 });
  }

  const kakaoUrl =
    "https://kauth.kakao.com/oauth/authorize" +
    `?client_id=${REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code`;

  return NextResponse.redirect(kakaoUrl);
}
