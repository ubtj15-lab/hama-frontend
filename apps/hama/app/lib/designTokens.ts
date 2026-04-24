/** 결정형 UX — 색·간격·타이포·그림자 토큰 (인라인 스타일용). globals.css --hama-* 토큰과 맞춤. */

export const colors = {
  bgDefault: "#FAFAF7",
  bgSurface: "#ffffff",
  bgCard: "#ffffff",
  bgMuted: "#FFF9F2",
  bgInput: "#FFF9F2",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  borderSubtle: "#EEEEE8",
  borderStrong: "#EEEEE8",
  accentPrimary: "#FF6B00",
  accentSoft: "#FFE4CC",
  accentStrong: "#FF6B00",
  accentOnPrimary: "#ffffff",
  reasonHot: "#FF6B00",
  tagMutedBg: "#FFF4E6",
  tagMutedText: "#111827",
  tagDeepBg: "#FFF4E6",
  tagDeepText: "#111827",
  tagDeepBorder: "rgba(255, 107, 0, 0.22)",
  statusOpen: "#22C55E",
  statusWarning: "#ca8a04",
  statusClosed: "#9CA3AF",
  successSoft: "#dcfce7",
  warningSoft: "#fef9c3",
  heroTint: "#FFF9F2",
} as const;

export const radius = {
  largeCard: 24,
  card: 24,
  input: 999,
  searchBar: 999,
  button: 16,
  chip: 10,
  pill: 999,
  fab: 999,
} as const;

export const space = {
  pageX: 20,
  /** 섹션 간 세로 간격 */
  section: 28,
  sectionTight: 20,
  card: 12,
  chip: 8,
  buttonGap: 10,
  heroBottom: 20,
  /** 카드 내부 패딩 */
  cardPadding: 16,
} as const;

export const shadow = {
  soft: "0 4px 16px rgba(17, 24, 39, 0.06)",
  card: "0 4px 20px rgba(255, 107, 0, 0.08)",
  elevated: "0 4px 20px rgba(255, 107, 0, 0.08)",
  cta: "0 8px 20px rgba(17, 24, 39, 0.2)",
  headerBtn: "0 4px 14px rgba(17, 24, 39, 0.08)",
} as const;

export const categoryTokens = {
  FOOD: { bg: "#FFF4E6", ring: "#FF6B00" },
  ACTIVITY: { bg: "#FFE4F1", ring: "#E91E63" },
  CAFE: { bg: "#F0EBFF", ring: "#8B5CF6" },
  PARK: { bg: "#E3F2E3", ring: "#7AC77A" },
} as const;

export const typo = {
  heroTitle: { fontSize: 32, fontWeight: 900 as const, letterSpacing: "-0.038em" as const, lineHeight: 1.18 as const },
  sectionTitle: { fontSize: 18, fontWeight: 800 as const, letterSpacing: "-0.02em" as const },
  cardTitle: { fontSize: 17, fontWeight: 800 as const },
  cardReason: { fontSize: 14, fontWeight: 700 as const },
  body: { fontSize: 15, fontWeight: 500 as const },
  caption: { fontSize: 13, fontWeight: 500 as const },
  button: { fontSize: 14, fontWeight: 800 as const },
  chip: { fontSize: 12, fontWeight: 700 as const },
  /** 하위 호환 */
  title: { fontSize: 30, fontWeight: 900 as const },
} as const;
