import { Suspense } from "react";
import KakaoSuccessClient from "./KakaoSuccessClient";

export default function KakaoSuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>카카오 로그인 처리중...</div>}>
      <KakaoSuccessClient />
    </Suspense>
  );
}
