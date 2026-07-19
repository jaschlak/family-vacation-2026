CREATE TABLE IF NOT EXISTS meal_assignments (
  trip_date TEXT NOT NULL CHECK (trip_date BETWEEN '2026-07-18' AND '2026-07-25'),
  slot TEXT NOT NULL CHECK (slot IN ('helper', 'lunch', 'dinner')),
  assigned_to TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (trip_date, slot)
);

CREATE INDEX IF NOT EXISTS meal_assignments_by_date ON meal_assignments (trip_date);
