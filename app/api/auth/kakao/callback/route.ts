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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    // code 없으면 홈으로 에러 표시만
    return NextResponse.redirect(new URL("/?kakao_error=no_code", req.url));
  }

  const REST_KEY = process.env.KAKAO_REST_KEY;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;

  if (!REST_KEY || !REDIRECT_URI) {
    console.error("🚨 Kakao env 가 없습니다. (.env.local 확인)");
    return NextResponse.redirect(
      new URL("/?kakao_error=server_config", req.url)
    );
  }

  // 1) 인가 코드로 액세스 토큰 받기
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
      new URL("/?kakao_error=token_failed", req.url)
    );
  }

  const tokenJson = (await tokenRes.json()) as KakaoTokenResponse;
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    console.error("🚨 access_token 없음", tokenJson);
    return NextResponse.redirect(
      new URL("/?kakao_error=no_access_token", req.url)
    );
  }

  // 2) 액세스 토큰으로 사용자 정보 가져오기
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
      new URL("/?kakao_error=user_failed", req.url)
    );
  }

  const me = (await meRes.json()) as KakaoUserResponse;

  const kakaoId = me.id;
  const nickname =
    me.kakao_account?.profile?.nickname ?? "카카오 사용자";
  const email = me.kakao_account?.email ?? "";

  // 3) 지금은 DB 대신 쿠키에 "가짜 유저 + 포인트 0" 저장
  //    나중에 Prisma + DB 연결하면 여기 부분만 교체하면 됨.
  const userForCookie = {
    kakaoId,
    nickname,
    email,
    points: 0, // 초기 포인트는 0
  };

  cookies().set("hama_user", JSON.stringify(userForCookie), {
    httpOnly: false, // 베타에서는 프론트에서 읽을 수 있게 둠 (나중에 세션으로 바꿔도 됨)
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  // 4) 로그인 성공 후 홈으로 돌려보내기
  return NextResponse.redirect(new URL("/?kakao_login=success", req.url));
}
