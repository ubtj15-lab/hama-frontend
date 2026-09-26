export function adminAccessMessage(status: number): string | null {
  if (status === 401) return "관리자 화면은 카카오 로그인이 필요해요.";
  if (status === 403) return "이 계정에는 관리자 권한이 없어요.";
  return null;
}
