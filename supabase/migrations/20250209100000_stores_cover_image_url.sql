-- 매장 대표 이미지 (추천 카드에 노출)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
