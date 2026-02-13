import { Suspense } from "react";
import RecommendClient from "./RecommendClient";

export default function RecommendPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>추천 불러오는 중...</div>}>
      <RecommendClient />
    </Suspense>
  );
}
