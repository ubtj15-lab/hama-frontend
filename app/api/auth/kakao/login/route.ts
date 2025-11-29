// app/api/auth/kakao/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const REDIRECT_URI =
    (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || "").trim();

  if (!REST_KEY || !REDIRECT_URI) {
    return new Response("Kakao env not set", { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: REST_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
  });

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(kakaoAuthUrl);
}
