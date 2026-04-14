import type { HomeCard } from "@/lib/storeTypes";

/**
 * DB 태그가 부족할 때 시나리오 점수용 blob 에 힌트 문구를 덧붙임(실제 DB 변경 없음).
 */
export function enrichBlobForScenarioScoring(baseBlob: string): string {
  const b = baseBlob.toLowerCase();
  const hints: string[] = [];

  if (/분위기|로맨틱|감성|야경|루프탑|테라스|캔들|인스타/.test(b)) {
    hints.push("분위기좋음 감성 야경");
  }
  if (/브런치|디저트|케이크|마카롱|티라미수|베이커리/.test(b)) {
    hints.push("브런치 디저트");
  }
  if (/조용|한적|잔잔|대화/.test(b)) {
    hints.push("조용함 대화하기좋음");
  }
  if (/혼밥|1인|카운터|빠른|가성비|회전/.test(b)) {
    hints.push("혼밥가능 빠른식사 카운터좌석 가성비");
  }

  if (hints.length === 0) return baseBlob;
  return `${baseBlob} ${hints.join(" ")}`.trim();
}

export function hasExplicitFamilySignalsInBlob(blob: string): boolean {
  return /(아이|키즈|유아|가족|영유아|초등|어린이|아이동반|키즈룸|유아의자)/.test(blob);
}
