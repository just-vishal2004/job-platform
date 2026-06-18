import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { SubmitJobRequest } from '@job-platform/types';

// This maps database snake_case columns to camelCase TypeScript objects.
// We do this once here so every other part of the app uses clean TS types.
function mapJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    payload: row.payload,
    status: row.status,
    priority: row.priority,
    maxRetries: row.max_retries,
    retryCount: row.retry_count,
    scheduledAt: row.scheduled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJob(input: SubmitJobRequest) {
  const { name, payload, priority = 5, maxRetries = 3, scheduledAt = null } = input;

  const { rows } = await pool.query(
    `INSERT INTO jobs (name, payload, priority, max_retries, scheduled_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, payload, priority, maxRetries, scheduledAt]
  );

  logger.info('Job created', { jobId: rows[0].id, name, priority });
  return mapJob(rows[0]);
}

export async function getJobs(filters: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, limit = 20, offset = 0 } = filters;

  // We build the query conditionally so filtering by status is optional.
  // Using parameterized queries ($1, $2) prevents SQL injection — never
  // interpolate user input directly into a query string.
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  params.push(limit);
  params.push(offset);

  const { rows } = await pool.query(
    `SELECT * FROM jobs
     ${whereClause}
     ORDER BY priority DESC, created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return rows.map(mapJob);
}

export async function getJobById(id: string) {
  const { rows } = await pool.query(
    `SELECT * FROM jobs WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) return null;
  return mapJob(rows[0]);
}

export async function getJobWithExecutions(id: string) {
  const job = await getJobById(id);
  if (!job) return null;

  const { rows: executions } = await pool.query(
    `SELECT
       je.*,
       w.hostname AS worker_hostname
     FROM job_executions je
     LEFT JOIN workers w ON w.id = je.worker_id
     WHERE je.job_id = $1
     ORDER BY je.attempt ASC`,
    [id]
  );

  const { rows: logs } = await pool.query(
    `SELECT * FROM execution_logs
     WHERE job_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  return { job, executions, logs };
}

export async function cancelJob(id: string) {
  // Only pending or queued jobs can be cancelled.
  // A running job cannot be cancelled without coordinating with the worker.
  const { rows } = await pool.query(
    `UPDATE jobs
     SET status = 'cancelled'
     WHERE id = $1
       AND status IN ('pending', 'queued')
     RETURNING *`,
    [id]
  );

  if (rows.length === 0) return null;

  logger.info('Job cancelled', { jobId: id });
  return mapJob(rows[0]);
}
