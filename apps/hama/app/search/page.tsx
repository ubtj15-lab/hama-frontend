import { Suspense } from "react";
import { colors, pageBackground } from "@/lib/designTokens";
import SearchResultsV2Client from "./SearchResultsV2Client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: pageBackground,
            fontFamily: "Noto Sans KR, system-ui, sans-serif",
            fontWeight: 700,
            color: colors.textSecondary,
          }}
        >
          추천 결과를 불러오는 중...
        </div>
      }
    >
      <SearchResultsV2Client />
    </Suspense>
  );
}
