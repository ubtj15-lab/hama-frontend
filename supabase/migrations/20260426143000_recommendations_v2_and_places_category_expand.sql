-- Expand `places.category` to match app-level taxonomy (food/cafe/salon/museum/activity)
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_category_check;
ALTER TABLE places
ADD CONSTRAINT places_category_check
CHECK (category IN ('museum', 'activity', 'food', 'cafe', 'salon'));

-- Structured recommendation analytics (separate from `recommendation_events` stream)
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  day_of_week SMALLINT,
  time_of_day TEXT,

  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,

  user_profile JSONB NOT NULL DEFAULT '{}'::jsonb,

  category_clicked TEXT,
  scenario TEXT,

  shown_place_ids TEXT[] NOT NULL DEFAULT '{}',
  main_pick_id TEXT,

  recommendation_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,

  weather TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_session_id ON recommendations(session_id);

CREATE TABLE IF NOT EXISTS recommendation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  recommendation_id UUID NULL REFERENCES recommendations(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,

  action TEXT NOT NULL,
  selected_place_id TEXT,
  reject_reason TEXT,

  correction_used TEXT,
  correction_value JSONB,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recommendation_responses_created_at ON recommendation_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_responses_recommendation_id ON recommendation_responses(recommendation_id);

CREATE TABLE IF NOT EXISTS corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  recommendation_id UUID NULL REFERENCES recommendations(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,

  kind TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  free_text TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_recommendation_id ON corrections(recommendation_id);
