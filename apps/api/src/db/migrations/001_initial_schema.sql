CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE worker_status AS ENUM ('idle', 'busy', 'dead');

CREATE TABLE workers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname       VARCHAR(255) NOT NULL,
  status         worker_status NOT NULL DEFAULT 'idle',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_workers_status_heartbeat
  ON workers(status, last_heartbeat);

CREATE TYPE job_status AS ENUM (
  'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TABLE jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       job_status NOT NULL DEFAULT 'pending',
  priority     SMALLINT NOT NULL DEFAULT 5
                 CHECK (priority BETWEEN 1 AND 10),
  max_retries  SMALLINT NOT NULL DEFAULT 3
                 CHECK (max_retries >= 0),
  retry_count  SMALLINT NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_scheduler
  ON jobs(status, scheduled_at, priority DESC, created_at ASC);

CREATE TYPE execution_status AS ENUM (
  'assigned', 'running', 'completed', 'failed', 'timed_out'
);

CREATE TABLE job_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  attempt       SMALLINT NOT NULL DEFAULT 1,
  status        execution_status NOT NULL DEFAULT 'assigned',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ NULL,
  error_message TEXT NULL
);

CREATE INDEX idx_executions_job_id ON job_executions(job_id);
CREATE INDEX idx_executions_worker_status
  ON job_executions(worker_id, status)
  WHERE status IN ('assigned', 'running');

CREATE TYPE log_level AS ENUM ('info', 'warn', 'error');

CREATE TABLE execution_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id  UUID NULL REFERENCES workers(id) ON DELETE SET NULL,
  level      log_level NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_job_id_created
  ON execution_logs(job_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
