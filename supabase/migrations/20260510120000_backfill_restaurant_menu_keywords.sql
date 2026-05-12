-- 음식 검색 보강: restaurant 매장 이름(name) 패턴 기준으로 menu_keywords(TEXT[]) merge · dedupe
-- 참고: menu_keywords 컬럼은 TEXT[] (20260328120000_stores_food_fields). 요청된 JSONB와 달리 DB는 배열 타입이라 유지합니다.
--
-- 확인용 (수동):
--   SELECT name, category, menu_keywords
--   FROM public.stores
--   WHERE category = 'restaurant' AND menu_keywords IS NOT NULL
--   LIMIT 50;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS menu_keywords TEXT[];

WITH base AS (
  SELECT
    s.id,
    s.menu_keywords AS old_kw,
    COALESCE(s.menu_keywords, ARRAY[]::TEXT[]) ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(고기|갈비|삼겹|숯불|정육|갈매기|갈비살|불고기|육회|고깃집)'
      THEN ARRAY['고기','고기집','삼겹살','갈비','숯불','정육식당','불고기']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(냉면|막국수|밀면)'
      THEN ARRAY['냉면','물냉면','비빔냉면','막국수','밀면']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ E'(쌀국수|베트남|[Pp][Hh][Oo]|분짜|반미|\\m포\\M)'
      THEN ARRAY['쌀국수','베트남','pho','분짜','반미']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(중국|중화|짜장|자장|짬뽕|탕수육|마라)'
      THEN ARRAY['중국집','중화요리','중식','짜장면','자장면','짬뽕','탕수육']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(파스타|스파게티|이탈리안|피자|리조또)'
      THEN ARRAY['파스타','스파게티','이탈리안','피자','리조또']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(돈까스|돈가스|카츠)'
      THEN ARRAY['돈까스','돈가스','카츠','일식돈까스']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(국밥|순대국|해장국|감자탕|설렁탕|곰탕)'
      THEN ARRAY['국밥','순대국','해장국','감자탕','설렁탕','곰탕']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END ||
    CASE WHEN lower(trim(COALESCE(s.name,''))) ~ '(분식|떡볶이|김밥|순대|라면|튀김)'
      THEN ARRAY['분식','떡볶이','김밥','순대','라면','튀김']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END AS bundled
  FROM public.stores s
  WHERE lower(trim(COALESCE(s.category,''))) = 'restaurant'
),
dedup AS (
  SELECT
    id,
    old_kw,
    ARRAY(
      SELECT DISTINCT trim(x)
      FROM unnest(bundled) AS t(x)
      WHERE trim(x) <> ''
      ORDER BY trim(x)
    ) AS merged
  FROM base
)
UPDATE public.stores AS s
SET menu_keywords = d.merged
FROM dedup d
WHERE s.id = d.id;


-- 패턴별 매칭 매장 수(이름 조건 만족) — 실행 후 출력용
DO $$
DECLARE
  c_meat int;
  c_naeng int;
  c_pho int;
  c_cn int;
  c_pasta int;
  c_katsu int;
  c_guk int;
  c_bunsik int;
  c_restaurant int;
  c_kw int;
BEGIN
  SELECT COUNT(*) INTO c_restaurant FROM public.stores WHERE lower(trim(COALESCE(category,''))) = 'restaurant';

  SELECT COUNT(*) INTO c_meat FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(고기|갈비|삼겹|숯불|정육|갈매기|갈비살|불고기|육회|고깃집)';
  SELECT COUNT(*) INTO c_naeng FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(냉면|막국수|밀면)';
  SELECT COUNT(*) INTO c_pho FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ E'(쌀국수|베트남|[Pp][Hh][Oo]|분짜|반미|\\m포\\M)';
  SELECT COUNT(*) INTO c_cn FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(중국|중화|짜장|자장|짬뽕|탕수육|마라)';
  SELECT COUNT(*) INTO c_pasta FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(파스타|스파게티|이탈리안|피자|리조또)';
  SELECT COUNT(*) INTO c_katsu FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(돈까스|돈가스|카츠)';
  SELECT COUNT(*) INTO c_guk FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(국밥|순대국|해장국|감자탕|설렁탕|곰탕)';
  SELECT COUNT(*) INTO c_bunsik FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND lower(trim(COALESCE(name,''))) ~ '(분식|떡볶이|김밥|순대|라면|튀김)';

  SELECT COUNT(*) INTO c_kw FROM public.stores
    WHERE lower(trim(COALESCE(category,''))) = 'restaurant'
      AND COALESCE(menu_keywords, ARRAY[]::TEXT[]) <> ARRAY[]::TEXT[];

  RAISE NOTICE '[restaurant_menu_keywords_backfill] total_restaurant= %', c_restaurant;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_meat_galbi= %', c_meat;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_naengmyeon_makguksu= %', c_naeng;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_pho_banhmi= %', c_pho;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_chinese= %', c_cn;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_pasta_pizza= %', c_pasta;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_tonkatsu= %', c_katsu;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_gukbap= %', c_guk;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] name_match_bunsik= %', c_bunsik;
  RAISE NOTICE '[restaurant_menu_keywords_backfill] restaurant_with_nonempty_menu_keywords= %', c_kw;
END $$;
