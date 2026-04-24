import React from "react";
import type { IconProps } from "./types";

export function CoffeeIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 10h9a0 0 0 0 1 0 0v3.2A4.8 4.8 0 0 1 9.2 18H9a4 4 0 0 1-4-4V10Z" />
      <path d="M14 11h1.5a2 2 0 1 1 0 4H14" />
      <path d="M6 21h10" />
      <path d="M8.2 4.8c.9.6.9 1.5 0 2.1M10.8 4.2c.9.6.9 1.8 0 2.5" />
    </svg>
  );
}
