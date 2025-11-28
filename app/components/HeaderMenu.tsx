"use client";

import { Button } from "@/components/ui/button";

const hamaUser = typeof window !== "undefined"
  ? JSON.parse(localStorage.getItem("hamaUser") || "null")
  : null;

const isLoggedIn = Boolean(hamaUser?.nickname);

export default function HeaderMenu() {
  const handleClick = () => {
    if (isLoggedIn) {
      // 1) 브라우저에 저장된 유저 정보 삭제
      if (typeof window !== "undefined") {
        localStorage.removeItem("hamaUser");
      }

      // 2) 서버 로그아웃(지금은 그냥 메인으로 redirect만 함)
      window.location.href = "/api/auth/kakao/logout";
    } else {
      // 로그인 시작
      window.location.href = "/api/auth/kakao/login";
    }
  };

  return (
    <Button onClick={handleClick}>
      {isLoggedIn ? "로그아웃" : "카카오로 로그인"}
    </Button>
  );
}
