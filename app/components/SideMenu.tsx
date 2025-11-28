"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HamaUser {
  nickname: string;
  point: number;
}

export default function SideMenu() {
  const router = useRouter();

  const [hamaUser, setHamaUser] = useState<HamaUser | null>(null);

  // 브라우저에 저장된 하마 유저 정보 가져오기
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem("hamaUser");
      if (!raw) return;
      const parsed = JSON.parse(raw) as HamaUser;
      setHamaUser(parsed);
    } catch {
      // 깨진 데이터면 그냥 무시
      setHamaUser(null);
    }
  }, []);

  const isLoggedIn = Boolean(hamaUser?.nickname);

  const handlePrimaryButtonClick = () => {
    if (isLoggedIn) {
      // 로그아웃: 저장된 유저 정보 제거 + 로그아웃 API로 이동
      if (typeof window !== "undefined") {
        localStorage.removeItem("hamaUser");
      }
      router.push("/api/auth/kakao/logout");
    } else {
      // 로그인 시작
      router.push("/api/auth/kakao/login");
    }
  };

  const nicknameLabel = isLoggedIn
    ? `${hamaUser?.nickname} 님`
    : "게스트 님";

  const pointLabel = isLoggedIn
    ? (hamaUser?.point ?? 0).toLocaleString() + " P"
    : "0 P";

  return (
    <div style={{ padding: 16 }}>
      {/* 상단 인사 영역 */}
      <div style={{ marginBottom: 12 }}>
        <div>안녕하세요 👋</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{nicknameLabel}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>포인트✨</div>
        <span style={{ fontWeight: 700 }}>{pointLabel}</span>
      </div>

      {/* 메인 버튼 (로그인 / 로그아웃) */}
      <button
        onClick={handlePrimaryButtonClick}
        style={{
          width: "100%",
          height: 48,
          borderRadius: 999,
          border: "none",
          background: "#FEE500",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        {isLoggedIn ? "로그아웃" : "카카오로 로그인"}
      </button>

      {/* 아래 나머지 메뉴는 기존 그대로 두면 됨 */}
      {/* 필요하면 여기 밑에 '오늘의 추천 보기', '내 예약', '최근 본 매장' 같은 기존 JSX 계속 이어서 쓰기 */}
    </div>
  );
}
