// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type KakaoTokenResponse = {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type KakaoUserResponse = {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

const FRONT_BASE =
  process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || "https://hama-frontend.vercel.app";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?kakao_error=no_code", FRONT_BASE));
  }

  // 🔑 여기서도 같은 이름 + trim
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const REDIRECT_URI = (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || "").trim();

  if (!REST_KEY || !REDIRECT_URI) {
    console.error("🚨 Kakao env 없음", { REST_KEY, REDIRECT_URI });
    return NextResponse.redirect(
      new URL("/?kakao_error=server_config", FRONT_BASE)
    );
  }

  // 1) 인가 코드 → 액세스 토큰
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("🚨 Kakao token error", await tokenRes.text());
    return NextResponse.redirect(
      new URL("/?kakao_error=token_failed", FRONT_BASE)
    );
  }

  const tokenJson = (await tokenRes.json()) as KakaoTokenResponse;
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    console.error("🚨 access_token 없음", tokenJson);
    return NextResponse.redirect(
      new URL("/?kakao_error=no_access_token", FRONT_BASE)
    );
  }

  // 2) 사용자 정보 조회
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });

  if (!meRes.ok) {
    console.error("🚨 Kakao me error", await meRes.text());
    return NextResponse.redirect(
      new URL("/?kakao_error=user_failed", FRONT_BASE)
    );
  }

  const me = (await meRes.json()) as KakaoUserResponse;

  const kakaoId = me.id;
  const nickname = me.kakao_account?.profile?.nickname ?? "카카오 사용자";
  const email = me.kakao_account?.email ?? "";

  const userForCookie = {
    kakaoId,
    nickname,
    email,
    points: 0,
  };

  cookies().set("hama_user", JSON.stringify(userForCookie), {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  const redirectUrl = new URL("/", FRONT_BASE);
  redirectUrl.searchParams.set("kakao_login", "success");

  return NextResponse.redirect(redirectUrl);
}
