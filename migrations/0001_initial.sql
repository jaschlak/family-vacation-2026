CREATE TABLE IF NOT EXISTS trip_days (
  trip_date TEXT PRIMARY KEY CHECK (trip_date BETWEEN '2026-07-18' AND '2026-07-25'),
  family_name TEXT,
  claimed_by TEXT,
  claimed_at TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  audience TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  info_url TEXT,
  notes TEXT,
  submitted_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS activities_by_start ON activities (starts_at);

INSERT OR IGNORE INTO trip_days (trip_date) VALUES
  ('2026-07-18'), ('2026-07-19'), ('2026-07-20'), ('2026-07-21'),
  ('2026-07-22'), ('2026-07-23'), ('2026-07-24'), ('2026-07-25');

INSERT INTO activities (title, audience, starts_at, ends_at, notes, submitted_by)
SELECT
  'Drive into City & Park',
  '["Everyone"]',
  '2026-07-22T06:00',
  '2026-07-22T22:00',
  'Part of Terri''s NY Sightseeing plan.',
  'Terri Schlak'
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE title = 'Drive into City & Park' AND submitted_by = 'Terri Schlak');

INSERT INTO activities (title, audience, starts_at, ends_at, info_url, notes, submitted_by)
SELECT
  '9/11 Memorial',
  '["Everyone"]',
  '2026-07-22T06:00',
  '2026-07-22T22:00',
  'https://www.911memorial.org/',
  'Walk to the 9/11 Memorial. Memorial admission is free.',
  'Terri Schlak'
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE title = '9/11 Memorial' AND submitted_by = 'Terri Schlak');

INSERT INTO activities (title, audience, starts_at, ends_at, info_url, notes, submitted_by)
SELECT
  'Ferry to Ellis Island and/or Liberty Island',
  '["Everyone"]',
  '2026-07-22T06:00',
  '2026-07-22T22:00',
  'https://www.statuecitycruises.com/',
  'Walk to the ferry terminal. About $26/person. Visit the Ellis Island museum and/or the Liberty Island museum. Choose one, or rush through both.',
  'Terri Schlak'
WHERE NOT EXISTS (
  SELECT 1 FROM activities
  WHERE title = 'Ferry to Ellis Island and/or Liberty Island' AND submitted_by = 'Terri Schlak'
);
