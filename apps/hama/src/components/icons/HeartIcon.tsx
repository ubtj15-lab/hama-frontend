import React from "react";
import type { IconProps } from "./types";

export function HeartIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 20s-6.8-4.6-8.5-8A4.8 4.8 0 0 1 12 7.2 4.8 4.8 0 0 1 20.5 12C18.8 15.4 12 20 12 20Z" />
    </svg>
  );
}
