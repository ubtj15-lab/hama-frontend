-- stores에 owner_id 추가 (매장주 연결)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id) WHERE owner_id IS NOT NULL;
