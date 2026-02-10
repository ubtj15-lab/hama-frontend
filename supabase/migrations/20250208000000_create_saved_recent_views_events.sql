-- 하마 통합플랫폼: saved, recent_views, events 테이블
-- Supabase SQL Editor에서 실행하거나, supabase db push 사용

-- 1. 이벤트 로그
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id) WHERE user_id IS NOT NULL;

-- 2. 저장 (북마크)
CREATE TABLE IF NOT EXISTS saved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user_id ON saved(user_id);

-- 3. 최근 본
CREATE TABLE IF NOT EXISTS recent_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_views_user_viewed ON recent_views(user_id, viewed_at DESC);

-- RLS (Row Level Security) - anon 접근 허용 (필요시 조정)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_views ENABLE ROW LEVEL SECURITY;

-- anon으로 INSERT/SELECT 허용 (Supabase anon key 사용 시)
CREATE POLICY "events_anon_all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "saved_anon_all" ON saved FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "recent_views_anon_all" ON recent_views FOR ALL USING (true) WITH CHECK (true);
