import React from "react";
import { colors } from "@/lib/designTokens";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
};

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: colors.neutral[100],
        animation: "hama-skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    >
      <style>
        {`@keyframes hama-skeleton-pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}
      </style>
    </div>
  );
}
