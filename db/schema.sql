CREATE TABLE IF NOT EXISTS records (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (table_name, id)
);

CREATE INDEX IF NOT EXISTS records_table_name_idx ON records (table_name);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('internal', 'dealer', 'customer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  quote_revision_id TEXT NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('concept', 'bevestigd', 'in_productie', 'gereed', 'geleverd', 'geannuleerd')),
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS immutable_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('quote_revision', 'order', 'configuration')),
  source_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'technical_sheet', 'bom', 'order_confirmation')),
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_type, source_id, document_type, version)
);

CREATE TABLE IF NOT EXISTS guided_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('suggestion', 'accepted', 'rejected')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS orders_org_idx ON orders(organization_id, created_at);
CREATE INDEX IF NOT EXISTS documents_source_idx ON immutable_documents(source_type, source_id);
