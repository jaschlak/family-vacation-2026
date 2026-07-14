ALTER TABLE activities
ADD COLUMN is_everyday INTEGER NOT NULL DEFAULT 0 CHECK (is_everyday IN (0, 1));

CREATE INDEX IF NOT EXISTS activities_by_everyday ON activities (is_everyday);
