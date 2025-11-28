// app/api/auth/kakao/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

// 배포 환경이면 vercel 주소, 로컬이면 3000
const FRONT_BASE =
  process.env.NEXT_PUBLIC_KAKAO_LOGOUT_REDIRECT_URI || "http://localhost:3000";

export async function GET(req: NextRequest) {
  // 카카오 쪽으로 가지 않고, 그냥 우리 서비스 메인으로 보내기
  return NextResponse.redirect(FRONT_BASE);
}
