'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ---- Web Speech API 타입 선언 (빌드 에러 방지) ----
// 브라우저 음성 인식 타입은 베타용이라 any 로 단순 처리
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}


export default function HomePage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any | null>(null);


  // 🔊 음성 인식 초기 세팅
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('이 브라우저는 음성 인식을 지원하지 않아요 ㅠㅠ');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

recognition.onresult = (event: any) => {
  const transcript = event.results[0][0].transcript.trim();
  setQuery(transcript);
  handleSearch(transcript);
};


    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔍 검색 실행 (지금은 /search 로 라우팅 – 원하면 /recommend 등으로 바꿔도 됨)
  const handleSearch = (text?: string) => {
    const keyword = (text ?? query).trim();
    if (!keyword) return;

    router.push(`/search?query=${encodeURIComponent(keyword)}`);
  };

  // 🎙 마이크 클릭
  const handleMicClick = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않아요 ㅠㅠ (크롬 권장)');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch {
        // 이미 실행 중일 때 start() 호출 에러 방지
      }
    }
  };

  // 🍔 메뉴 버튼 (지금은 일단 콘솔만 — 나중에 사이드 메뉴 붙이면 됨)
  const handleMenuClick = () => {
    console.log('메뉴 버튼 클릭');
    // TODO: 베타 메뉴 UI 여기서 열기
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#e9f2fb',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          margin: '0 auto',
          padding: '24px 16px 40px',
          boxSizing: 'border-box',
        }}
      >
        {/* 상단 검색바 + 메뉴 */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22,
          }}
        >
          {/* 햄버거 버튼 */}
          <button
            type="button"
            onClick={handleMenuClick}
            aria-label="메뉴 열기"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: 'none',
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 2,
                borderRadius: 999,
                background: '#111827',
                boxShadow: '0 6px 0 #111827, 0 -6px 0 #111827',
              }}
            />
          </button>

          {/* 검색 인풋 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: 999,
              padding: '0 6px 0 20px',
              boxShadow: '0 8px 18px rgba(15,23,42,0.14)',
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장소를 말하거나 입력하세요 (예: 카페 찾아줘)"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                height: 44,
                fontSize: 14,
                background: 'transparent',
              }}
            />
            <button
              type="button"
              onClick={() => handleSearch()}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '0 18px',
                height: 36,
                marginRight: 4,
                background:
                  'linear-gradient(135deg, #2563eb, #4f46e5)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 14px rgba(37,99,235,0.45)',
              }}
            >
              검색
            </button>
          </div>
        </header>

        {/* 하마 카드 */}
        <section
          style={{
            background: '#cde7ff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 12px 24px rgba(15,23,42,0.16)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
            minHeight: 260,
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 30,
              overflow: 'hidden',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/images/hama.png" // public/images/hama.png 파일 필요
              alt="하마"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </section>

        {/* 마이크 버튼 */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={handleMicClick}
            aria-label="음성 검색 시작"
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              border: 'none',
              background: isListening ? '#1d4ed8' : '#ffffff',
              boxShadow: '0 14px 26px rgba(15,23,42,0.20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease, transform 0.1s ease',
              transform: isListening ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: isListening ? '#ffffff' : '#2563eb',
              }}
            >
              🎙
            </span>
          </button>

          <p
            style={{
              fontSize: 12,
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
          </p>
        </section>
      </div>
    </main>
  );
}
