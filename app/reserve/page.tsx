import { Suspense } from "react";
import ReserveClient from "./ReserveClient";

export default function ReservePage() {
  return (
    <Suspense fallback={<div>불러오는 중...</div>}>
      <ReserveClient />
    </Suspense>
  );
}
