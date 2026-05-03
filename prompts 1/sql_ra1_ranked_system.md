# Akyra — SQL: RA1 Ranked System Foundation

Run all blocks in order in Supabase SQL editor.

---

## Block 1 — Challenge Patterns (Heatmap data)

```sql
CREATE TABLE IF NOT EXISTS challenge_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  associate_id UUID REFERENCES associates(id) ON DELETE SET NULL,
  associate_name TEXT NOT NULL,
  supervisor_id UUID REFERENCES associates(id) ON DELETE SET NULL,
  supervisor_name TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'associate_task',
    'supervisor_task',
    'associate_supervisor'
  )),
  challenge_count INTEGER NOT NULL DEFAULT 1,
  window_start DATE NOT NULL DEFAULT CURRENT_DATE,
  window_end DATE NOT NULL GENERATED ALWAYS AS (window_start + INTERVAL '90 days') STORED,
  flag_level TEXT NOT NULL DEFAULT 'watch' CHECK (flag_level IN (
    'watch',
    'retrain',
    'sop_review',
    'bias_review'
  )),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS challenge_patterns_store_idx
  ON challenge_patterns(store_id, is_resolved, window_end);

CREATE INDEX IF NOT EXISTS challenge_patterns_associate_task_idx
  ON challenge_patterns(associate_id, task_id, pattern_type)
  WHERE pattern_type = 'associate_task';

CREATE INDEX IF NOT EXISTS challenge_patterns_supervisor_idx
  ON challenge_patterns(supervisor_id, associate_id, pattern_type)
  WHERE pattern_type = 'associate_supervisor';

CREATE INDEX IF NOT EXISTS challenge_patterns_district_idx
  ON challenge_patterns(district_id, flag_level)
  WHERE district_id IS NOT NULL;

ALTER TABLE challenge_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow anon select" ON challenge_patterns FOR SELECT TO anon USING (true);
CREATE POLICY "allow anon insert" ON challenge_patterns FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow anon update" ON challenge_patterns FOR UPDATE TO anon USING (true);
```

---

## Block 2 — Associate Rankings

```sql
CREATE TABLE IF NOT EXISTS associate_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  associate_id UUID NOT NULL REFERENCES associates(id) ON DELETE CASCADE,
  associate_name TEXT NOT NULL,

  points_tasks INTEGER NOT NULL DEFAULT 0,
  points_verified INTEGER NOT NULL DEFAULT 0,
  points_assists INTEGER NOT NULL DEFAULT 0,
  points_kill_leader INTEGER NOT NULL DEFAULT 0,
  points_mvp INTEGER NOT NULL DEFAULT 0,
  points_vindicated INTEGER NOT NULL DEFAULT 0,
  points_total INTEGER NOT NULL DEFAULT 0,

  tier TEXT NOT NULL DEFAULT 'Platinum'
    CHECK (tier IN ('Platinum', 'Diamond', 'Master', 'Predator')),
  tier_changed_at TIMESTAMPTZ,
  previous_tier TEXT,

  is_predator BOOLEAN NOT NULL DEFAULT false,
  is_succession_candidate BOOLEAN NOT NULL DEFAULT false,
  is_desynced BOOLEAN NOT NULL DEFAULT false,
  desync_reason TEXT,
  desync_since TIMESTAMPTZ,
  desync_cleared_at TIMESTAMPTZ,
  desync_assists_needed INTEGER NOT NULL DEFAULT 3,
  desync_assists_completed INTEGER NOT NULL DEFAULT 0,

  last_calculated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (store_id, associate_id)
);

CREATE INDEX IF NOT EXISTS rankings_store_tier_idx
  ON associate_rankings(store_id, tier, points_total DESC);

CREATE INDEX IF NOT EXISTS rankings_org_predator_idx
  ON associate_rankings(org_id, is_predator)
  WHERE is_predator = true;

CREATE INDEX IF NOT EXISTS rankings_district_idx
  ON associate_rankings(district_id, points_total DESC)
  WHERE district_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rankings_desynced_idx
  ON associate_rankings(store_id, is_desynced)
  WHERE is_desynced = true;

ALTER TABLE associate_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow anon select" ON associate_rankings FOR SELECT TO anon USING (true);
CREATE POLICY "allow anon insert" ON associate_rankings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow anon update" ON associate_rankings FOR UPDATE TO anon USING (true);
```

---

## Block 3 — Points Log

```sql
CREATE TABLE IF NOT EXISTS points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  associate_id UUID NOT NULL REFERENCES associates(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'task_complete',
    'task_verified',
    'assist_given',
    'kill_leader',
    'mvp',
    'challenge_vindicated',
    'desync_cleared'
  )),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS points_log_associate_date_idx
  ON points_log(associate_id, shift_date);

CREATE INDEX IF NOT EXISTS points_log_store_date_idx
  ON points_log(store_id, shift_date);

ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow anon select" ON points_log FOR SELECT TO anon USING (true);
CREATE POLICY "allow anon insert" ON points_log FOR INSERT TO anon WITH CHECK (true);
```

---

## Block 4 — Shift extension columns

```sql
ALTER TABLE active_shifts
  ADD COLUMN IF NOT EXISTS is_extended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ;
```

---

## Block 5 — base_points default

```sql
ALTER TABLE tasks
  ALTER COLUMN base_points SET DEFAULT 10;

UPDATE tasks SET base_points = 10 WHERE base_points IS NULL OR base_points = 0;
```

---

## Block 6 — Verify

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('challenge_patterns', 'associate_rankings', 'points_log');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'associate_rankings'
AND column_name IN (
  'tier', 'is_predator', 'is_succession_candidate', 'is_desynced',
  'points_total', 'desync_assists_needed', 'desync_assists_completed'
);

SELECT column_name FROM information_schema.columns
WHERE table_name = 'active_shifts'
AND column_name IN ('is_extended', 'extension_reason', 'original_end_time', 'scheduled_end_time');
```

Expected: 3 tables, 7 ranking columns, 4 shift columns.
