ALTER TABLE users
ADD COLUMN IF NOT EXISTS user_profile JSONB;

CREATE INDEX IF NOT EXISTS idx_users_user_profile_gin
ON users
USING GIN (user_profile);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_store_id UUID NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('museum', 'activity')),
  area TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  with_kids BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_area ON places(area);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS places_public_read ON places;
CREATE POLICY places_public_read ON places FOR SELECT USING (true);
