import { redirectToKakaoLogin } from "./kakaoLogin";

export function isReceiptLoginRequiredResponse(res: Response, json: { error?: string }): boolean {
  return res.status === 401 && json.error === "LOGIN_REQUIRED";
}

export function handleReceiptLoginRequired(nextPath?: string): void {
  alert("영수증 인증은 카카오 로그인이 필요해요.");
  redirectToKakaoLogin(nextPath);
}
