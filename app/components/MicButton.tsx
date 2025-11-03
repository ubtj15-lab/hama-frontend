'use client';

import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (finalText: string) => void; // 음성 인식 결과 콜백
};

export default function MicButton({ onResult }: Props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SR) {
      console.warn("⚠️ Web Speech API is not supported in this browser.");
      return;
    }

    const recog: any = new SR();
    recog.lang = "ko-KR";
    recog.interimResults = false;
    recog.continuous = false; // 한 문장씩만 처리

    recog.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();

      console.log("[🎙️ 인식 결과]:", text);
      if (text) onResult?.(text);
    };

    recog.onerror = (e: any) => {
      console.error("STT Error:", e);
      // 네트워크, 무음 등 특정 오류는 자동 복구(선택)
      const autoRetry = ["network", "no-speech", "aborted", "audio-capture"].includes(e?.error);
      if (autoRetry && listening) {
        setTimeout(() => {
          try { recog.stop(); } catch {}
          try { recog.start(); } catch {}
        }, 600);
      } else {
        setListening(false);
      }
    };

    recog.onend = () => {
      console.log("🎤 음성 인식 종료");
      setListening(false);
    };

    recognitionRef.current = recog as any;

    return () => {
      try { recog.stop(); } catch {}
      (recog as any).onresult = null;
      (recog as any).onerror = null;
      (recog as any).onend = null;
    };
  }, [onResult, listening]);

  const handleClick = () => {
    const recog: any = recognitionRef.current as any;
    if (!recog) {
      alert("이 브라우저는 음성인식을 지원하지 않아요 😢");
      return;
    }

    if (listening) {
      try { recog.stop(); } catch {}
      setListening(false);
    } else {
      try {
        recog.start();
        setListening(true);
      } catch (e) {
        console.error("Recognition start failed:", e);
        setListening(false);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 rounded-full shadow-lg px-5 py-4 text-white"
      style={{
        background: listening ? "#f43f5e" : "#2563eb",
        zIndex: 9999, // 지도 위로 올리기
        position: "fixed",
      }}
      aria-label="음성 검색"
      title="음성 검색"
    >
      {listening ? "🎙️ 듣는 중..." : "🎤 말하기"}
    </button>
  );
}
