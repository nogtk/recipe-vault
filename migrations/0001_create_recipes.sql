CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('want_to_make', 'made')),
  tags TEXT NOT NULL DEFAULT '[]',
  ingredients TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_recipes_updated_at ON recipes(updated_at);
CREATE INDEX idx_recipes_status ON recipes(status);
