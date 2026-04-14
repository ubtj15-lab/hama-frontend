/** 결정형 UX — 색·간격·타이포·그림자 토큰 (인라인 스타일용). globals.css --hama-* 토큰과 맞춤. */

export const colors = {
  /** 따뜻한 캔버스(라이프스타일 추천 톤) */
  bgDefault: "#faf8f5",
  bgSurface: "#ffffff",
  bgCard: "#ffffff",
  bgMuted: "#f4f0ea",
  bgInput: "#faf8f5",
  textPrimary: "#0f172a",
  textSecondary: "#57534e",
  textMuted: "#94a3b8",
  borderSubtle: "#e7e5e4",
  borderStrong: "#d6d3d1",
  /** 브랜드 프라이머리 — 신뢰 블루 유지 */
  accentPrimary: "#2563eb",
  accentSoft: "#eff6ff",
  accentStrong: "#1d4ed8",
  accentOnPrimary: "#ffffff",
  /** 추천 이유 강조(🔥 라인) */
  reasonHot: "#c2410c",
  /** 태그·칩 — 소프트 블루 */
  tagMutedBg: "#eff6ff",
  tagMutedText: "#1d4ed8",
  /** 상황 배지 — 스톤 톤(프로토 pill 느낌 완화) */
  tagDeepBg: "#fff7ed",
  tagDeepText: "#9a3412",
  tagDeepBorder: "rgba(234, 88, 12, 0.22)",
  statusOpen: "#16a34a",
  statusWarning: "#ca8a04",
  statusClosed: "#94a3b8",
  successSoft: "#dcfce7",
  warningSoft: "#fef9c3",
  heroTint: "#FFF7ED",
} as const;

export const radius = {
  /** 카드 메인 — 목업 24~28px */
  largeCard: 26,
  card: 20,
  input: 999,
  searchBar: 999,
  button: 14,
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
  soft: "0 4px 18px rgba(15, 23, 42, 0.06)",
  card: "0 8px 24px rgba(15, 23, 42, 0.07)",
  elevated: "0 12px 32px rgba(15, 23, 42, 0.09)",
  cta: "0 6px 20px rgba(59, 130, 246, 0.22)",
  headerBtn: "0 4px 14px rgba(15, 23, 42, 0.08)",
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
