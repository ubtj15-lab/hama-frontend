import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/login 은 예외로 통과
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  // /admin/* 보호
  if (pathname.startsWith("/admin")) {
    const has = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!has) {
      const url = new URL("/admin/login", req.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
