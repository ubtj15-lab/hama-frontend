/**
 * stores: 키즈 제외 대상·보드카페 리스트 (수동 검증용). 서비스 롤 필요.
 *
 *   npm run audit:kid-stores
 *   npm run audit:persona-stores
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { isKidFocusedVenueFields, isKidVenueExcludedWhenNoYoungChildFromParts } from "../app/lib/recommend/kidVenueSignals";
import { isBoardGameVenueFields } from "../app/lib/recommend/boardVenueSignals";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type Row = {
  id: unknown;
  name: unknown;
  category: unknown;
  with_kids: unknown;
  tags: unknown;
  mood: unknown;
  description: unknown;
};

function rowParts(r: Row) {
  const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
  const mood = Array.isArray(r.mood) ? r.mood.map(String) : [];
  return {
    id: String(r.id),
    name: r.name != null ? String(r.name) : "",
    category: r.category != null ? String(r.category) : null,
    with_kids: r.with_kids === true ? true : r.with_kids === false ? false : null,
    tags,
    mood,
    description: typeof r.description === "string" ? r.description : null,
  };
}

function printList(title: string, items: { id: string; name: string }[], max = 40) {
  console.log(`\n=== ${title} (n=${items.length}) ===`);
  for (const x of items.slice(0, max)) {
    console.log(`- ${x.id}\t${x.name}`);
  }
  if (items.length > max) console.log(`... 외 ${items.length - max}건`);
}

async function main() {
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,category,with_kids,tags,mood,description")
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  const kidFocused: { id: string; name: string }[] = [];
  const kidExclude: { id: string; name: string }[] = [];
  const boardList: { id: string; name: string }[] = [];

  let catKidsCafe = 0;
  let withKidsTrue = 0;
  let nameHasKids = 0;

  for (const r of rows) {
    const p = rowParts(r);
    const catLower = (p.category ?? "").toLowerCase();
    if (catLower.includes("키즈카페")) catKidsCafe++;
    if (p.with_kids === true) withKidsTrue++;
    if (p.name.toLowerCase().includes("키즈")) nameHasKids++;

    if (
      isKidFocusedVenueFields({
        name: p.name,
        category: p.category,
        tags: p.tags,
        mood: p.mood,
        description: p.description,
      })
    ) {
      kidFocused.push({ id: p.id, name: p.name });
    }
    if (
      isKidVenueExcludedWhenNoYoungChildFromParts({
        name: p.name,
        category: p.category,
        tags: p.tags,
        mood: p.mood,
        description: p.description,
        with_kids: p.with_kids,
      })
    ) {
      kidExclude.push({ id: p.id, name: p.name });
    }
    if (isBoardGameVenueFields({ name: p.name, category: p.category, tags: p.tags })) {
      boardList.push({ id: p.id, name: p.name });
    }
  }

  console.log("=== stores 페르소나 점검 ===");
  console.log(`총 행: ${rows.length}`);
  console.log(`category에 '키즈카페' 포함: ${catKidsCafe}`);
  console.log(`with_kids = true: ${withKidsTrue}`);
  console.log(`매장명에 '키즈' 포함: ${nameHasKids}`);
  console.log(`isKidFocusedVenueFields true: ${kidFocused.length}`);
  console.log(`영유아 '없음' 시 필터 대상(isKidVenueExcluded…): ${kidExclude.length}`);
  console.log(`보드카페 휴리스틱: ${boardList.length}`);

  printList("키즈 브랜딩(포커스) 리스트", kidFocused);
  printList("영유아 없음 사용자 제외 리스트", kidExclude);
  printList("보드카페 리스트", boardList);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
