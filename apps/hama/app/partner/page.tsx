import { redirect } from "next/navigation";

const PARTNER_URL = process.env.NEXT_PUBLIC_PARTNER_APP_URL || "http://localhost:3001";

/** hama 앱에서 /partner 접근 시 매장주 앱(partner)으로 리다이렉트 */
export default function PartnerRedirect() {
  redirect(PARTNER_URL);
}
