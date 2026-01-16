import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>로딩중...</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
