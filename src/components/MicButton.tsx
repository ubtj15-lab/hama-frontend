"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (text: string) => void; // 인식된 텍스트를 부모로 전달
};

export default function MicButton({ onResult }: Props) {
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<any>(null);
  const supportedRef = useRef<boolean>(true);

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      supportedRef.current = false;
      return;
    }
    const recog = new SR();
    recog.lang = "ko-KR";
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onResult(text);
    };
    recog.onend = () => setRecording(false);
    recog.onerror = () => setRecording(false);

    recogRef.current = recog;
  }, [onResult]);

  const toggle = () => {
    if (!supportedRef.current) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요 😭\n(Chrome/Edge 권장, 모바일은 HTTPS 필요)");
      return;
    }
    if (!recogRef.current) return;
    if (recording) {
      try { recogRef.current.stop(); } catch {}
      setRecording(false);
    } else {
      try { recogRef.current.start(); setRecording(true); } catch {}
    }
  };

  return (
    <button
      onClick={toggle}
      style={{
        padding: "10px 16px",
        borderRadius: 999,
        background: recording ? "#ef4444" : "#22c55e",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontWeight: 700,
        marginRight: 8,
      }}
    >
      {recording ? "🎙️ 듣는 중… (눌러서 종료)" : "🎤 음성 검색"}
    </button>
  );
}
