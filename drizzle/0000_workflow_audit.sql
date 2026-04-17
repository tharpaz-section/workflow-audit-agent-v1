CREATE TABLE IF NOT EXISTS workflow_audit_runs (
  id uuid PRIMARY KEY,
  company_name text NOT NULL,
  department text NOT NULL,
  team text NOT NULL,
  role_title text NOT NULL,
  generation_mode text NOT NULL DEFAULT 'mock',
  status text NOT NULL DEFAULT 'in_progress',
  progress integer NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  prior_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS workflow_audit_messages (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES workflow_audit_runs(id) ON DELETE CASCADE,
  role text NOT NULL,
  card_kind text,
  content text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_audit_tasks (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES workflow_audit_runs(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  summary text,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  collaborators jsonb NOT NULL DEFAULT '[]'::jsonb,
  pain_level integer,
  estimated_hours_per_week numeric,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_audit_connections (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES workflow_audit_runs(id) ON DELETE CASCADE,
  source_task text NOT NULL,
  target_team text NOT NULL,
  target_label text NOT NULL,
  connection_type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_audit_results (
  run_id uuid PRIMARY KEY REFERENCES workflow_audit_runs(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_audit_runs_team_idx
  ON workflow_audit_runs(company_name, team, status);

CREATE INDEX IF NOT EXISTS workflow_audit_messages_run_idx
  ON workflow_audit_messages(run_id, created_at);

CREATE INDEX IF NOT EXISTS workflow_audit_tasks_run_idx
  ON workflow_audit_tasks(run_id);

CREATE INDEX IF NOT EXISTS workflow_audit_connections_run_idx
  ON workflow_audit_connections(run_id);
