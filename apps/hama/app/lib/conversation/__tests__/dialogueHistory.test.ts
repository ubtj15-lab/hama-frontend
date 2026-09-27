import { describe, expect, it } from "vitest";
import { upsertDialogueEntry } from "../dialogueHistory";

describe("dialogue history snapshots", () => {
  it("appends a later turn without replacing the earlier play cards", () => {
    const first = upsertDialogueEntry(undefined, {
      userText: "동탄에서 아이들이랑 놀 곳 찾아줘.",
      assistantText: "놀이",
      playCards: [
        { id: "a", name: "A", category: "activity" },
        { id: "b", name: "B", category: "activity" },
        { id: "c", name: "C", category: "activity" },
      ],
    });
    const indoor = upsertDialogueEntry(first, {
      userText: "비 오니까 실내로 추천해 줘.",
      assistantText: "실내",
      playCards: [
        { id: "d", name: "D", category: "activity" },
        { id: "e", name: "E", category: "activity" },
        { id: "f", name: "F", category: "activity" },
      ],
    });
    const meal = upsertDialogueEntry(indoor, {
      userText: "근처에서 밥 먹을 곳도 찾아줘.",
      assistantText: "식사",
      playCards: [
        { id: "d", name: "D", category: "activity" },
        { id: "e", name: "E", category: "activity" },
        { id: "f", name: "F", category: "activity" },
      ],
      foodCards: [{ id: "r1", name: "식당", category: "restaurant" }],
      provisional: true,
      anchorName: "D",
    });

    expect(meal.map((entry) => entry.userText)).toEqual([
      "동탄에서 아이들이랑 놀 곳 찾아줘.",
      "비 오니까 실내로 추천해 줘.",
      "근처에서 밥 먹을 곳도 찾아줘.",
    ]);
    expect(meal[0]?.playCards.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(meal[1]?.playCards.map((card) => card.id)).toEqual(["d", "e", "f"]);
    expect(meal[2]?.playCards.map((card) => card.id)).toEqual(["d", "e", "f"]);
    expect(meal[2]?.foodCards?.map((card) => card.id)).toEqual(["r1"]);
  });

  it("keeps two identical sentences as separate turns", () => {
    const first = upsertDialogueEntry(undefined, {
      turnId: "t1",
      userText: "같은 말",
      playCards: [{ id: "a", name: "A", category: "activity" }],
    });
    const second = upsertDialogueEntry(first, {
      turnId: "t2",
      userText: "같은 말",
      playCards: [{ id: "b", name: "B", category: "activity" }],
    });
    expect(second.map((entry) => entry.turnId)).toEqual(["t1", "t2"]);
    expect(second[0]?.playCards.map((card) => card.id)).toEqual(["a"]);
    expect(second[1]?.playCards.map((card) => card.id)).toEqual(["b"]);
  });
});
