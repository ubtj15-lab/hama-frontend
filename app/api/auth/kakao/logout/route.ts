// app/api/auth/kakao/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const LOGOUT_REDIRECT_URI =
    (process.env.NEXT_PUBLIC_KAKAO_LOGOUT_REDIRECT_URI || "").trim();

  if (!REST_KEY || !LOGOUT_REDIRECT_URI) {
    return new Response("Kakao env not set", { status: 500 });
  }

  // 여기서 우리 쪽 세션/쿠키 지우는 로직이 있다면 같이 실행
  // 예시:
  // const res = NextResponse.redirect(LOGOUT_REDIRECT_URI);
  // res.cookies.set("hama_session", "", { maxAge: 0, path: "/" });
  // return res;

  const params = new URLSearchParams({
    client_id: REST_KEY,
    logout_redirect_uri: LOGOUT_REDIRECT_URI,
  });

  const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?${params.toString()}`;

  return NextResponse.redirect(kakaoLogoutUrl);
}
