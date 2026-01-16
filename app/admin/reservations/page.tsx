import { Suspense } from "react";
import ReservationsClient from "./ReservationsClient";

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>예약 목록 불러오는 중...</div>}>
      <ReservationsClient />
    </Suspense>
  );
}
