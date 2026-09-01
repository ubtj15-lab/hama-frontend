import { describe, expect, it } from "vitest";
import {
  allowKidsOrientedPresentation,
  getReasonByCategory,
  getTagsByCategory,
  hasPositiveKidsPlaceSignal,
} from "../searchV2CategoryCopy";

const HOLDEM = {
  name: "헤즈업홀덤펍 동탄점",
  description: null,
  tags: ["기본", "보통", "액티비티"],
  with_kids: false as const,
};

describe("Search V2 kids presentation grounding", () => {
  it("CASE 1: activity + with_kids=false + no kids tag → no kids claim", () => {
    const hints = { name: "보드게임 체험관", description: null, tags: ["액티비티"], with_kids: false };
    expect(hasPositiveKidsPlaceSignal(hints)).toBe(false);
    expect(getTagsByCategory("activity", "아이랑 체험할 곳", hints)).not.toContain("#아이동반");
    expect(getReasonByCategory("activity", "아이랑 체험할 곳", hints)).not.toMatch(/아이와 함께/);
  });

  it("CASE 2: activity + with_kids=true may emit kids presentation", () => {
    const hints = { name: "체험관", description: null, tags: ["액티비티"], with_kids: true };
    expect(hasPositiveKidsPlaceSignal(hints)).toBe(true);
    expect(getTagsByCategory("activity", "", hints)).toContain("#아이동반");
    expect(getReasonByCategory("activity", "", hints)).toMatch(/아이와 함께/);
  });

  it("CASE 3: activity + explicit kids tag may emit kids presentation", () => {
    const hints = { name: "체험관", description: null, tags: ["아이동반"], with_kids: null };
    expect(hasPositiveKidsPlaceSignal(hints)).toBe(true);
    expect(getTagsByCategory("activity", "", hints)).toContain("#아이동반");
    expect(getReasonByCategory("activity", "", hints)).toMatch(/아이와 함께/);
  });

  it("CASE 4: holdem/activity + with_kids=false → no kids presentation", () => {
    expect(allowKidsOrientedPresentation("activity", HOLDEM)).toBe(false);
    expect(getTagsByCategory("activity", "아이랑 체험할 곳", HOLDEM)).not.toContain("#아이동반");
    expect(getReasonByCategory("activity", "아이랑 체험할 곳", HOLDEM)).not.toMatch(/아이와 함께/);
    expect(getReasonByCategory("activity", "아이랑 체험할 곳", HOLDEM)).toMatch(/가볍게 놀거나 체험/);
  });

  it("does not treat category=activity or 가벼운활동 as kids evidence", () => {
    const hints = { name: "일반 체험공간", description: "가벼운활동", tags: ["가벼운활동"], with_kids: false };
    expect(hasPositiveKidsPlaceSignal(hints)).toBe(false);
    expect(getTagsByCategory("activity", "", hints)).not.toContain("#아이동반");
  });
});
