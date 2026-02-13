"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function BetaInfoPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e9f2fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "32px 16px",
        boxSizing: "border-box",
        fontFamily: "Noto Sans KR, system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#ffffff",
          borderRadius: 24,
          boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
          padding: "22px 20px 24px",
          boxSizing: "border-box",
          color: "#111827",
        }}
      >
        {/* 제목 */}
        <header
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            하마 베타 안내
          </h1>
          <span style={{ fontSize: 20 }}>🦛</span>
        </header>

        {/* 인트로 */}
        <section
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 18,
            color: "#374151",
          }}
        >
          <p style={{ margin: 0, marginBottom: 4 }}>
            지금은 <b>하마 서비스 클로즈드 베타(Ver. 0.1)</b> 기간이에요.
          </p>
          <p style={{ margin: 0 }}>
            실제 서비스와 거의 동일하게 동작하지만, 일부 기능은 테스트 중이라
            <b> 예고 없이 변경·중단</b>될 수 있어요.
          </p>
        </section>

        {/* 현재 구현된 기능 */}
        <section style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>🛠</span>
            <span>현재 구현된 기능</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#374151",
            }}
          >
            <li>음성 검색 / 텍스트 검색</li>
            <li>카페 / 식당 / 미용실 추천 보기</li>
            <li>길안내 (카카오맵 기반)</li>
            <li>매장 상세 페이지</li>
            <li>피드백 보내기 (오류 신고 / 제안 / 불편한 점)</li>
          </ul>
        </section>

        {/* 테스터가 도와주면 좋은 점 */}
        <section style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>🧪</span>
            <span>테스터가 도와주면 좋은 점</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#374151",
            }}
          >
            <li>음성 인식이 잘 들렸는지 (단어를 이상하게 듣는 부분)</li>
            <li>추천 결과가 너무 엉뚱하지는 않은지</li>
            <li>매장 사진·설명·카테고리가 실제 느낌과 잘 맞는지</li>
            <li>화면 배치나 버튼 위치가 헷갈리지는 않는지</li>
          </ul>
        </section>

        {/* 포인트 보상 */}
        <section style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>🎁</span>
            <span>베타 참여 포인트 보상</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#374151",
            }}
          >
            <li>오류 신고: 300P</li>
            <li>제안하기: 200P</li>
            <li>스크린샷 포함 제보: 500P</li>
            <li>후기 제출: 300P</li>
            <li>예약·추천 기능 테스트: 50 ~ 100P</li>
          </ul>
        </section>

        {/* 포인트 정산 & 초기화 안내 */}
        <section style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>⏱</span>
            <span>포인트 정산 & 초기화 안내</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#374151",
            }}
          >
            <li>베타 종료 후, 계정당 <b>5,000P만 유지</b>되고 나머지 포인트는 초기화돼요.</li>
            <li>유지된 포인트는 <b>정식 서비스 오픈 시 그대로 사용</b>하실 수 있어요.</li>
          </ul>
        </section>

        {/* 감사 멘트 */}
        <section
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "#4b5563",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0 }}>
            🙏 테스트에 참여해 주셔서 정말 고마워요.
          </p>
          <p style={{ margin: 0 }}>
            여러분이 남겨주신 모든 피드백이 <b>하마를 진짜 서비스로 만드는 가장 큰 힘</b>이에요.
          </p>
        </section>

        {/* 돌아가기 버튼 */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              maxWidth: 260,
              borderRadius: 9999,
              border: "none",
              padding: "10px 0",
              fontSize: 14,
              fontWeight: 600,
              background:
                "linear-gradient(135deg, #2563eb, #4f46e5)",
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(37,99,235,0.45)",
            }}
          >
            돌아가기
          </button>
        </div>
      </div>
    </main>
  );
}
