// app/api/auth/kakao/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // 나중에 쿠키/세션 쓰면 여기서 삭제
  const url = new URL("/", req.url); // 홈으로 보내기
  return NextResponse.redirect(url);
}
