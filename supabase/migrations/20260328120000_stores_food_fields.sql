-- 음식 의도 랭킹·검색용 선택 필드 (없으면 tags/description 만으로 동작)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS menu_keywords TEXT[];
ALTER TABLE stores ADD COLUMN IF NOT EXISTS food_sub_category TEXT;

COMMENT ON COLUMN stores.menu_keywords IS '대표 메뉴·키워드 (짜장면, 초밥 등)';
COMMENT ON COLUMN stores.food_sub_category IS 'CHINESE | JAPANESE | KOREAN | WESTERN | FASTFOOD';
