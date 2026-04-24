import React from "react";
import type { IconProps } from "./types";

export function FerrisWheelIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="11" r="5.5" />
      <path d="M12 5.5V3.8M17 8l1.4-1.4M19 13h1.8M7 8 5.6 6.6M5 13H3.2M12 16.5l3.2 5.7H8.8L12 16.5Z" />
      <circle cx="12" cy="11" r="1.2" />
    </svg>
  );
}
