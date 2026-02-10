-- users 테이블 (카카오 로그인 연동)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id TEXT UNIQUE NOT NULL,
  nickname TEXT,
  role TEXT DEFAULT 'consumer',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);

-- RLS (callback에서 anon으로 upsert)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_anon_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_anon_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_anon_update" ON users FOR UPDATE USING (true);
