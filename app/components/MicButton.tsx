'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onResult: (text: string) => void;
  size?: number;
  style?: React.CSSProperties;
};

// ✅ 브라우저 SpeechRecognition을 대신할 커스텀 타입
type LocalSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;

  start: () => void;
  stop: () => void;
  abort: () => void;

  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
};

const MicButton: React.FC<Props> = ({ onResult, size = 96, style }) => {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<LocalSpeechRecognition | null>(null);

  // 🎙 음성 인식 준비
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      console.warn('이 브라우저는 음성 인식을 지원하지 않아요 ㅠㅠ');
      return;
    }

    const recognition = new SpeechRecognitionCtor() as LocalSpeechRecognition;
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('SpeechRecognition error:', event);
      setListening(false);
    };

    recognition.onresult = (event: any) => {
      const res = event.results?.[0]?.[0];
      if (res && typeof res.transcript === 'string') {
        onResult(res.transcript);
      }
    };

    recogRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [onResult]);

  const handleClick = () => {
    const recog = recogRef.current;
    if (!recog) {
      alert('이 브라우저에서는 음성 인식을 사용할 수 없어요 ㅠㅠ');
      return;
    }

    try {
      if (listening) {
        recog.stop();
      } else {
        recog.start();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const buttonSize = size;
  const iconSize = size * 0.4;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        width: buttonSize,
        height: buttonSize,
        borderRadius: 999,
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        background: listening ? '#2563eb' : '#ffffff',
        boxShadow: listening
          ? '0 14px 30px rgba(37,99,235,0.48)'
          : '0 10px 22px rgba(15,23,42,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition:
          'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
        transform: listening ? 'translateY(2px)' : 'translateY(0)',
        ...style,
      }}
    >
      {/* 마이크 아이콘 (간단한 SVG) */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={listening ? '#ffffff' : '#2563eb'}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14ZM17.3 11C17.3 13.89 14.99 16.2 12.1 16.2C9.21 16.2 6.9 13.89 6.9 11H5C5 14.16 7.42 16.86 10.5 17.39V20H13.5V17.39C16.58 16.86 19 14.16 19 11H17.3Z" />
      </svg>
    </button>
  );
};

export default MicButton;
