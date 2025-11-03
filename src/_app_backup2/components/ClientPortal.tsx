"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function ClientPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  console.log("[PORTAL] mounted"); // ← 이 로그가 콘솔에 찍혀야 해
  return createPortal(children, document.body);
}
