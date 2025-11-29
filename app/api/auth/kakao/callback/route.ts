// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const REDIRECT_URI =
    (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || "").trim();

  if (!REST_KEY || !REDIRECT_URI) {
    return new Response("Kakao env not set", { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return new Response("No code from kakao", { status: 400 });
  }

  // 토큰 요청
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return new Response("Failed to get token from kakao", { status: 500 });
  }

  const tokenJson = await tokenRes.json();

  // TODO: 여기서 tokenJson.access_token 으로 유저 정보 받아서
  //       쿠키/세션 세팅하는 로직 (지금 쓰는 거 그대로 두면 됨)

  // 일단 홈으로 리다이렉트
  return NextResponse.redirect(new URL("/", req.url));
}
