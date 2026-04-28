export type CompanionOption = "혼자" | "둘이서" | "가족" | "친구";
export type GenderOption = "남성" | "여성" | "선택 안 함";
export type DietaryOption = "채식" | "할랄" | "알레르기" | "없음";
export type InterestOption =
  | "전시/박물관"
  | "산책/공원"
  | "액티비티"
  | "만화카페/보드게임카페"
  | "영화/공연";

/** 만 6세 미만 자녀와 외출 빈도 — 동반자(companions)와 별도 축 */
export type YoungChildOption = "있음" | "없음";

export type UserProfile = {
  companions: CompanionOption[];
  gender: GenderOption;
  dietary_restrictions: DietaryOption[];
  /** 영유아 자녀 유무 (미저장·구버전 프로필은 parse 시 '없음'으로 보수 처리) */
  young_child: YoungChildOption;
  interests: InterestOption[];
  onboarding_completed_at: string | null;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  companions: [],
  gender: "선택 안 함",
  dietary_restrictions: ["없음"],
  young_child: "없음",
  interests: [],
  onboarding_completed_at: null,
};

export const YOUNG_CHILD_OPTIONS: YoungChildOption[] = ["있음", "없음"];

export const COMPANION_OPTIONS: CompanionOption[] = ["혼자", "둘이서", "가족", "친구"];
export const GENDER_OPTIONS: GenderOption[] = ["남성", "여성", "선택 안 함"];
export const DIETARY_OPTIONS: DietaryOption[] = ["채식", "할랄", "알레르기", "없음"];
export const INTEREST_OPTIONS: InterestOption[] = [
  "전시/박물관",
  "산책/공원",
  "액티비티",
  "만화카페/보드게임카페",
  "영화/공연",
];

export function parseUserProfile(input: unknown): UserProfile {
  if (!input || typeof input !== "object") return { ...DEFAULT_USER_PROFILE };
  const obj = input as Record<string, unknown>;
  const companions = asStringArray(obj.companions).filter((v): v is CompanionOption =>
    COMPANION_OPTIONS.includes(v as CompanionOption)
  );
  const gender = GENDER_OPTIONS.includes(obj.gender as GenderOption)
    ? (obj.gender as GenderOption)
    : "선택 안 함";
  const dietary = asStringArray(obj.dietary_restrictions).filter((v): v is DietaryOption =>
    DIETARY_OPTIONS.includes(v as DietaryOption)
  );
  const interests = asStringArray(obj.interests).filter((v): v is InterestOption =>
    INTEREST_OPTIONS.includes(v as InterestOption)
  );
  const onboardingCompletedAt =
    typeof obj.onboarding_completed_at === "string" && obj.onboarding_completed_at.length > 0
      ? obj.onboarding_completed_at
      : null;

  const youngRaw = obj.young_child;
  const young_child: YoungChildOption = youngRaw === "있음" ? "있음" : "없음";

  return {
    companions,
    gender,
    dietary_restrictions: dietary.length ? dietary : ["없음"],
    young_child,
    interests,
    onboarding_completed_at: onboardingCompletedAt,
  };
}

export function isOnboardingCompleted(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.onboarding_completed_at);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}
