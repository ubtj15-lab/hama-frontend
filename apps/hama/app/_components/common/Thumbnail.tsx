"use client";

import React from "react";

type Props = {
  src: string;
  alt: string;
  size?: number;
  radius?: number;
};

export function Thumbnail({ src, alt, size = 84, radius = 14 }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        background: "#e2e8f0",
      }}
    >
      <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}
