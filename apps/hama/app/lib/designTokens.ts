/** 결정형 UX — 색·간격·타이포·그림자 토큰 (인라인 스타일용). globals.css --hama-* 토큰과 맞춤. */

export const colors = {
  primary: "#FF6B35",
  primaryLight: "rgba(255, 107, 53, 0.1)",
  primaryDark: "#B84E0B",
  bgCream: "#FAF6EF",
  bgWhite: "#FFFFFF",
  neutral: {
    50: "#FAFAFA",
    100: "#F5F2EC",
    300: "#D4D0C6",
    500: "#888780",
    700: "#5F5E5A",
    900: "#1A1A1A",
  },
  category: {
    family: "#FFF1E0",
    date: "#FDE4EC",
    solo: "#E3EDF9",
    course: "#E5F0E0",
  },
  bgDefault: "#FAF6EF",
  bgSurface: "#FFFFFF",
  bgCard: "#FFFFFF",
  bgMuted: "#F5F2EC",
  bgInput: "#F5F2EC",
  textPrimary: "#1A1A1A",
  textSecondary: "#5F5E5A",
  textMuted: "#888780",
  borderSubtle: "#D4D0C6",
  borderStrong: "#D4D0C6",
  accentPrimary: "#FF6B35",
  accentSoft: "rgba(255, 107, 53, 0.1)",
  accentStrong: "#B84E0B",
  accentOnPrimary: "#FFFFFF",
  reasonHot: "#B84E0B",
  tagMutedBg: "#F5F2EC",
  tagMutedText: "#5F5E5A",
  tagDeepBg: "rgba(255, 107, 53, 0.1)",
  tagDeepText: "#B84E0B",
  tagDeepBorder: "rgba(255, 107, 53, 0.25)",
  statusOpen: "#22C55E",
  statusWarning: "#ca8a04",
  statusClosed: "#9CA3AF",
  successSoft: "#dcfce7",
  warningSoft: "#fef9c3",
  heroTint: "#FAF6EF",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  xl: 16,
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
  card: "0 4px 20px rgba(255, 107, 53, 0.08)",
  elevated: "0 4px 20px rgba(255, 107, 53, 0.08)",
  cta: "0 8px 20px rgba(17, 24, 39, 0.2)",
  headerBtn: "0 4px 14px rgba(17, 24, 39, 0.08)",
} as const;

export const categoryTokens = {
  FOOD: { bg: "#FFF1E0", ring: "#FF6B35" },
  ACTIVITY: { bg: "#FDE4EC", ring: "#FF6B35" },
  CAFE: { bg: "#E3EDF9", ring: "#FF6B35" },
  PARK: { bg: "#E5F0E0", ring: "#FF6B35" },
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
