CREATE TABLE IF NOT EXISTS activity_votes (
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  PRIMARY KEY (activity_id, voter_id)
);
