// app/lib/useMicMock.ts
"use client";

import { useRef, useState } from "react";

export default function useMicMock(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setListening(true);
    timer.current && clearTimeout(timer.current);
    // 1.6초 뒤에 가짜 결과 콜백
    timer.current = setTimeout(() => {
      setListening(false);
      onText("서울시청 근처 파스타집 찾아줘");
    }, 1600);
  };

  const stop = () => {
    setListening(false);
    timer.current && clearTimeout(timer.current);
  };

  return { listening, start, stop };
}
