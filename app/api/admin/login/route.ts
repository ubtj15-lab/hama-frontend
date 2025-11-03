import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "존재하지 않는 관리자입니다." },
        { status: 401 }
      );
    }

    // 비밀번호 비교
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 로그인 성공 → 쿠키 설정
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, user.id, cookieOptions);

    return res;
  } catch (err) {
    console.error("❌ 로그인 에러:", err);
    return NextResponse.json(
      { ok: false, error: "서버 내부 오류입니다." },
      { status: 500 }
    );
  }
}
