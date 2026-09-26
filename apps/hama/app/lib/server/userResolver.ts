import type { NextRequest } from "next/server";
import { getVerifiedUserId } from "./verifiedSession";

/** 서버가 발급한 세션만 사용자 식별에 사용한다. */
export async function getVerifiedUserIdFromRequest(req: NextRequest): Promise<string | null> {
  return getVerifiedUserId(req);
}

/**
 * 서명 없는 `hama_user_id` 쿠키는 신원이 아니다.
 * 기존 라우트가 `getUserIdFromAuthCookie(req)`로 호출하므로 인자는 유지한다.
 */
export function getUserIdFromAuthCookie(_req: NextRequest): string | null {
  return null;
}

/** 요청 본문의 user_id와 레거시 쿠키는 무시하고 서버 세션만 본다. */
export async function resolveUserIdFromRequest(
  req: NextRequest,
  _incomingUserId?: string | null
): Promise<string | null> {
  return getVerifiedUserId(req);
}
