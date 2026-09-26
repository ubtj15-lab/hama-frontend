import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUserId } from "./verifiedSession";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CAPABILITY_FLAGS = [
  "solo_friendly",
  "group_seating",
  "private_room",
  "alcohol_available",
  "fast_food",
  "formal_atmosphere",
  "quick_service",
  "vegan_available",
  "halal_available",
  "with_kids",
] as const;

/** UUID만 모은 명단. 비어 있거나 형식이 깨지면 null이며, 그 경우 관리자 접근은 거부된다. */
export function readAdminUserIds(): Set<string> | null {
  const raw = process.env.HAMA_ADMIN_USER_IDS;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const ids = new Set<string>();
  for (const part of parts) {
    if (!UUID_RE.test(part)) return null;
    ids.add(part.toLowerCase());
  }
  return ids;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isSafeResourceId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && !/[\s/?#\\]/.test(id);
}

export function parseStoreCapabilityBody(
  body: unknown
): Record<string, boolean | number | null> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const update: Record<string, boolean | number | null> = {};
  for (const key of CAPABILITY_FLAGS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const value = record[key];
    if (value !== null && typeof value !== "boolean") return null;
    update[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(record, "max_group_size")) {
    const value = record.max_group_size;
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1000)
    ) {
      return null;
    }
    update.max_group_size = value;
  }
  return Object.keys(update).length > 0 ? update : null;
}

function writeSourceOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin;
  const referer = req.headers.get("referer")?.trim();
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function hasTrustedWriteSource(req: NextRequest): boolean {
  const source = writeSourceOrigin(req);
  return source !== null && source === req.nextUrl.origin;
}

function denied(status: 401 | 403, error: "unauthorized" | "forbidden" | "csrf_rejected"): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * 세션이 없으면 401, 명단이 없거나 일반 사용자이면 403.
 * 쓰기 요청은 같은 출처의 Origin 또는 Referer가 있어야 한다.
 * 이 함수는 관리자 데이터 테이블을 읽지 않는다.
 */
export async function enforceAdmin(
  req: NextRequest,
  options?: { mutate?: boolean }
): Promise<NextResponse | null> {
  const userId = await getVerifiedUserId(req);
  if (!userId || !isUuid(userId)) return denied(401, "unauthorized");
  const allowlist = readAdminUserIds();
  if (!allowlist || !allowlist.has(userId.toLowerCase())) return denied(403, "forbidden");
  if (options?.mutate && !hasTrustedWriteSource(req)) return denied(403, "csrf_rejected");
  return null;
}
