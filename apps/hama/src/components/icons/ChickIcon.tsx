import React from "react";
import type { IconProps } from "./types";

export function ChickIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12.5" r="5.6" />
      <path d="m12 5.3 1.2-1.8 1.2 1.8" />
      <path d="M15 11.7h2.2l-1.2 1.3 1.2 1.3H15" />
      <circle cx="10.2" cy="12" r=".5" fill={color} stroke="none" />
      <circle cx="13.8" cy="12" r=".5" fill={color} stroke="none" />
      <path d="M11.1 14.2c.4.4.9.6 1.4.6s1-.2 1.4-.6" />
    </svg>
  );
}
