/** 결정형 UX — 색·간격·타이포 토큰 (인라인 스타일용) */

export const colors = {
  bgDefault: "#F8FAFC",
  bgCard: "#ffffff",
  bgMuted: "#f1f5f9",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSubtle: "#e2e8f0",
  accentPrimary: "#2563eb",
  accentSoft: "#dbeafe",
  accentStrong: "#1d4ed8",
  statusOpen: "#16a34a",
  statusWarning: "#ca8a04",
  statusClosed: "#94a3b8",
} as const;

export const radius = {
  largeCard: 24,
  card: 20,
  button: 14,
  pill: 999,
} as const;

export const space = {
  pageX: 20,
  section: 24,
  card: 12,
  chip: 8,
} as const;

export const typo = {
  title: { fontSize: 28, fontWeight: 800 as const },
  sectionTitle: { fontSize: 22, fontWeight: 700 as const },
  cardTitle: { fontSize: 18, fontWeight: 700 as const },
  body: { fontSize: 15, fontWeight: 400 as const },
  caption: { fontSize: 13, fontWeight: 500 as const },
} as const;
