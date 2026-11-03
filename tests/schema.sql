PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  verified_usage_count INTEGER NOT NULL DEFAULT 0 CHECK (verified_usage_count >= 0),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'review', 'suspended'))
);

CREATE TABLE IF NOT EXISTS project_votes (
  item_id TEXT NOT NULL,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  weight REAL NOT NULL CHECK (weight BETWEEN 0 AND 1),
  risk REAL NOT NULL CHECK (risk BETWEEN 0 AND 1),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'quarantined', 'withdrawn')),
  reason_codes TEXT NOT NULL DEFAULT '[]',
  policy_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (item_id, identity_id)
);
CREATE INDEX IF NOT EXISTS idx_project_votes_summary ON project_votes(item_id, status);

CREATE TABLE IF NOT EXISTS vote_audit (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  risk REAL NOT NULL,
  weight REAL NOT NULL,
  reason_codes TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vote_audit_identity_time ON vote_audit(identity_id, created_at);

CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expiry ON rate_buckets(expires_at);

CREATE TABLE IF NOT EXISTS risk_appeals (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  item_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  resolution TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_open_appeal ON risk_appeals(identity_id,item_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS arena_protocols (
  hash TEXT PRIMARY KEY,
  modality TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS arena_samples (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  model_revision TEXT NOT NULL,
  protocol_hash TEXT NOT NULL REFERENCES arena_protocols(hash),
  prompt_hash TEXT NOT NULL,
  output_sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL,
  submitted_by TEXT NOT NULL REFERENCES identities(id),
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  parameters_json TEXT NOT NULL,
  provenance_status TEXT NOT NULL CHECK (provenance_status IN ('pending','verified','rejected')),
  consent_to_publish INTEGER NOT NULL DEFAULT 0 CHECK (consent_to_publish IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_arena_samples_protocol_prompt ON arena_samples(protocol_hash,prompt_hash,provenance_status);
CREATE TABLE IF NOT EXISTS arena_assignments (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  sample_a TEXT NOT NULL REFERENCES arena_samples(id),
  sample_b TEXT NOT NULL REFERENCES arena_samples(id),
  protocol_hash TEXT NOT NULL REFERENCES arena_protocols(hash),
  prompt_hash TEXT NOT NULL,
  revealed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (sample_a != sample_b)
);
CREATE TABLE IF NOT EXISTS arena_votes (
  assignment_id TEXT PRIMARY KEY REFERENCES arena_assignments(id),
  identity_id TEXT NOT NULL REFERENCES identities(id),
  winner TEXT NOT NULL CHECK (winner IN ('a','b','tie','both_bad')),
  protocol_hash TEXT NOT NULL REFERENCES arena_protocols(hash),
  prompt_hash TEXT NOT NULL,
  model_pair_key TEXT NOT NULL,
  weight REAL NOT NULL CHECK (weight BETWEEN 0 AND 1),
  status TEXT NOT NULL CHECK (status IN ('accepted','quarantined','withdrawn')),
  policy_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(identity_id,protocol_hash,prompt_hash,model_pair_key)
);
CREATE INDEX IF NOT EXISTS idx_arena_assignments_identity ON arena_assignments(identity_id);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  item_id TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  coverage REAL NOT NULL,
  policy_version TEXT NOT NULL,
  PRIMARY KEY(item_id, captured_at, source)
);
