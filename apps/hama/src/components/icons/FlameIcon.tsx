import React from "react";
import type { IconProps } from "./types";

export function FlameIcon({ size = 16, color = "currentColor", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12.2 3.5c.3 2.2-.6 3.7-1.9 5.1-1.5 1.6-2.6 3.1-2.6 5.4a4.3 4.3 0 0 0 8.6 0c0-1.8-.8-3.2-2-4.4-.8-.8-1.5-1.9-1.2-3.5.1-.7-.7-1.2-1.2-.7-.6.6-1.1 1.2-1.5 1.9" />
      <path d="M10.3 17.4a1.7 1.7 0 0 0 3.4 0c0-.8-.4-1.4-.9-1.9-.4-.4-.8-.9-.6-1.6" />
    </svg>
  );
}
