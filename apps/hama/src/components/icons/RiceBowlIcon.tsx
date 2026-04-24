import React from "react";
import type { IconProps } from "./types";

export function RiceBowlIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14a7 7 0 0 1-14 0Z" />
      <path d="M8 15.5h8" />
      <path d="M9 5.2c1.2.7 1.2 1.9 0 2.6" />
      <path d="M12 4.6c1.2.8 1.2 2.1 0 3" />
      <path d="M15 5.2c1.2.7 1.2 1.9 0 2.6" />
    </svg>
  );
}
