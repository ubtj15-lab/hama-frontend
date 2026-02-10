import { Suspense } from "react";
import MapClient from "./MapClient";

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>지도 불러오는 중...</div>}>
      <MapClient />
    </Suspense>
  );
}
