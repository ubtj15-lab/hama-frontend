import React from "react";
import type { IconProps } from "./types";

export function FamilyIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6.5" cy="7.5" r="2" />
      <circle cx="17.5" cy="7.5" r="2" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M3.8 18.5v-.9a3 3 0 0 1 3-3h1.5" />
      <path d="M20.2 18.5v-.9a3 3 0 0 0-3-3h-1.5" />
      <path d="M8.4 19.2v-1.1A3.6 3.6 0 0 1 12 14.5a3.6 3.6 0 0 1 3.6 3.6v1.1" />
    </svg>
  );
}
