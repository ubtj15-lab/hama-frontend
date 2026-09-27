import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { mergeResultsScenario } from "../mergeResultsScenario";
import { isIndoorPlaySeekingQuery } from "@/lib/recommend/discoveryRole";

const LINES = [
  "동탄에서 아이들이랑 놀 곳 찾아줘.",
  "비 오니까 실내로 추천해 줘.",
  "근처에서 밥 먹을 곳도 알려줘.",
] as const;

function turns() {
  let ctx = null as ReturnType<typeof processConversationTurn> | null;
  return LINES.map((line) => {
    ctx = processConversationTurn(line, ctx, { persist: false });
    const merged = mergeResultsScenario(line, ctx)!;
    return {
      line,
      merged,
      linked: ctx.linkedPurposes?.map((item) => item.intentCategory) ?? [],
      loadsPlayCatalogFromCurrentSentence: isIndoorPlaySeekingQuery(line, merged),
      loadsPlayCatalogFromSavedIndoorActivity:
        merged.intentCategory === "ACTIVITY" && merged.indoorPreferred === true,
    };
  });
}

describe("composite indoor play catalog", () => {
  it("keeps region, kids, and indoor while the meal is a separate purpose", () => {
    const rows = turns();
    expect(rows[0]!.merged.region).toBe("동탄");
    expect(rows[0]!.merged.intentCategory).toBe("ACTIVITY");
    expect(rows[0]!.merged.withKids).toBe(true);
    expect(rows[1]!.merged.region).toBe("동탄");
    expect(rows[1]!.merged.indoorPreferred).toBe(true);
    expect(rows[1]!.merged.intentCategory).toBe("ACTIVITY");
    expect(rows[2]!.merged.region).toBe("동탄");
    expect(rows[2]!.merged.indoorPreferred).toBe(true);
    expect(rows[2]!.linked).toEqual(["FOOD"]);
    expect(rows[2]!.merged.intentCategory).toBe("ACTIVITY");
  });

  it("does not depend on the latest sentence containing 놀 to load indoor play places", () => {
    const rows = turns();
    expect(rows[1]!.loadsPlayCatalogFromCurrentSentence).toBe(false);
    expect(rows[2]!.loadsPlayCatalogFromCurrentSentence).toBe(false);
    expect(rows[1]!.loadsPlayCatalogFromSavedIndoorActivity).toBe(true);
    expect(rows[2]!.loadsPlayCatalogFromSavedIndoorActivity).toBe(true);
  });
});
