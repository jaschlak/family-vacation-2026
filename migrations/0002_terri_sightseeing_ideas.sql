-- Split Terri's original combined sightseeing entry into the three ideas
-- from her numbered list. This migration also updates databases where
-- 0001_initial.sql was applied before the ideas were separated.

UPDATE activities
SET
  title = 'Drive into City & Park',
  notes = 'Part of Terri''s NY Sightseeing plan.'
WHERE title = 'NY Sightseeing' AND submitted_by = 'Terri Schlak';

INSERT INTO activities (title, audience, starts_at, ends_at, info_url, notes, submitted_by)
SELECT
  'Drive into City & Park',
  '["Everyone"]',
  '2026-07-22T06:00',
  '2026-07-22T22:00',
  NULL,
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
