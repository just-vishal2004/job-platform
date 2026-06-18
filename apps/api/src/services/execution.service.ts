import { pool } from '../db/pool';
import { logger } from '../utils/logger';

function mapExecution(row: Record<string, unknown>) {
  return {
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    attempt: row.attempt,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    errorMessage: row.error_message ?? null,
  };
}

export async function startExecution(jobId: string, workerId: string, attempt: number) {
  const { rows } = await pool.query(
    `INSERT INTO job_executions (job_id, worker_id, attempt, status)
     VALUES ($1, $2, $3, 'assigned')
     RETURNING *`,
    [jobId, workerId, attempt]
  );
  return mapExecution(rows[0]);
}

export async function completeExecution(jobId: string, workerId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark the execution as completed
    await client.query(
      `UPDATE job_executions
       SET status = 'completed', finished_at = NOW()
       WHERE job_id = $1
         AND worker_id = $2
         AND status IN ('assigned', 'running')`,
      [jobId, workerId]
    );

    // Mark the job as completed
    await client.query(
      `UPDATE jobs SET status = 'completed' WHERE id = $1`,
      [jobId]
    );

    // Free the worker back to idle
    await client.query(
      `UPDATE workers SET status = 'idle' WHERE id = $1`,
      [workerId]
    );

    await client.query('COMMIT');
    logger.info('Job completed', { jobId, workerId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function failExecution(
  jobId: string,
  workerId: string,
  errorMessage: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark the execution as failed
    await client.query(
      `UPDATE job_executions
       SET status = 'failed',
           finished_at = NOW(),
           error_message = $3
       WHERE job_id = $1
         AND worker_id = $2
         AND status IN ('assigned', 'running')`,
      [jobId, workerId, errorMessage]
    );

    // Get current retry state
    const { rows } = await client.query(
      `SELECT retry_count, max_retries FROM jobs WHERE id = $1`,
      [jobId]
    );

    const { retry_count, max_retries } = rows[0];
    const newRetryCount = retry_count + 1;

    if (newRetryCount < max_retries) {
      // Exponential backoff with jitter:
      // delay = min(5 * 2^retry_count, 300) seconds + up to 10s jitter
      const baseDelay = Math.min(5 * Math.pow(2, retry_count), 300);
      const jitter = Math.random() * 10;
      const delaySeconds = Math.round(baseDelay + jitter);

      await client.query(
        `UPDATE jobs
         SET status = 'pending',
             retry_count = $2,
             scheduled_at = NOW() + INTERVAL '1 second' * $3
         WHERE id = $1`,
        [jobId, newRetryCount, delaySeconds]
      );

      logger.warn('Job failed, will retry', {
        jobId,
        attempt: newRetryCount,
        retryInSeconds: delaySeconds,
      });
    } else {
      // Exhausted all retries
      await client.query(
        `UPDATE jobs
         SET status = 'failed', retry_count = $2
         WHERE id = $1`,
        [jobId, newRetryCount]
      );

      logger.error('Job permanently failed', {
        jobId,
        totalAttempts: newRetryCount,
      });
    }

    // Free the worker back to idle regardless of retry outcome
    await client.query(
      `UPDATE workers SET status = 'idle' WHERE id = $1`,
      [workerId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateExecutionProgress(
  jobId: string,
  workerId: string,
  percent: number
) {
  // Mark the execution as actively running (moves from 'assigned')
  await pool.query(
    `UPDATE job_executions
     SET status = 'running'
     WHERE job_id = $1
       AND worker_id = $2
       AND status = 'assigned'`,
    [jobId, workerId]
  );

  // Log the progress as an execution log entry
  await pool.query(
    `INSERT INTO execution_logs (job_id, worker_id, level, message)
     VALUES ($1, $2, 'info', $3)`,
    [jobId, workerId, `Progress: ${percent}%`]
  );
}
