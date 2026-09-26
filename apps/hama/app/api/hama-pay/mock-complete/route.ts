import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 이 경로는 결제 승인 없이 hama_pay_transactions 를 completed 로 넣고
 * 방문 횟수를 올릴 수 있었다. 세션만으로는 결제를 완료로 인정하지 않는다.
 */
export async function POST() {
  return NextResponse.json({ ok: false, error: "payment_not_verified" }, { status: 403 });
}
