"use client";

import { useSearchParams } from "next/navigation";

export default function ReserveClient() {
  const searchParams = useSearchParams();

  const storeId = searchParams.get("storeId");
  const name = searchParams.get("name");

  return (
    <main style={{ padding: 20 }}>
      <h1>예약 페이지</h1>
      <div>매장 ID: {storeId}</div>
      <div>매장 이름: {name}</div>
    </main>
  );
}
