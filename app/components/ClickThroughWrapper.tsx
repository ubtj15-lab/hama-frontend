"use client";

import React from "react";

type Props = {
  /** 카드가 실제로 렌더되는 영역 */
  children: React.ReactNode;

  /**
   * 레이아웃용 wrapper 스타일(예: height: '70%', maxWidth 등)
   * 여기는 pointer-events: none 이 강제로 적용됨
   */
  wrapperStyle?: React.CSSProperties;

  /**
   * 카드 실제 영역 스타일
   * 여기는 pointer-events: auto 로 클릭/드래그가 살아남
   */
  contentStyle?: React.CSSProperties;

  className?: string;
};

export default function ClickThroughWrapper({
  children,
  wrapperStyle,
  contentStyle,
  className,
}: Props) {
  return (
    <div
      className={className}
      style={{
        ...wrapperStyle,
        // ✅ 핵심: 레이아웃 wrapper가 화면을 덮어도 클릭을 먹지 않게
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...contentStyle,
          // ✅ 핵심: 실제 카드/덱 영역만 클릭/드래그 활성화
          pointerEvents: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
