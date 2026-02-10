-- 매장주가 등록하는 매장 사진·메뉴

-- 1. 매장 사진
CREATE TABLE IF NOT EXISTS store_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_photos_store_id ON store_photos(store_id);

-- 2. 매장 메뉴
CREATE TABLE IF NOT EXISTS store_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_menus_store_id ON store_menus(store_id);

-- RLS: anon 허용 (실제 권한은 API에서 owner_id로 검사)
ALTER TABLE store_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_photos_anon_all" ON store_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "store_menus_anon_all" ON store_menus FOR ALL USING (true) WITH CHECK (true);
