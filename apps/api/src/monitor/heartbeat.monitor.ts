import { pool } from '../db/pool';
import { logger } from '../utils/logger';

async function recoverDeadWorkers(): Promise<void> {
  const timeoutSeconds = parseInt(
    process.env.HEARTBEAT_TIMEOUT_SECONDS ?? '45'
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find all non-dead workers whose heartbeat has expired.
    // We lock them immediately so concurrent monitor instances
    // (if you ever run multiple API servers) don't double-process.
    const { rows: deadWorkers } = await client.query(
      `UPDATE workers
       SET status = 'dead'
       WHERE status != 'dead'
         AND last_heartbeat < NOW() - INTERVAL '1 second' * $1
       RETURNING id, hostname`,
      [timeoutSeconds]
    );

    if (deadWorkers.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    logger.warn('Dead workers detected', {
      count: deadWorkers.length,
      workers: deadWorkers.map((w) => ({
        id: w.id,
        hostname: w.hostname,
      })),
    });

    // Process each dead worker's jobs
    for (const worker of deadWorkers) {
      await recoverJobsForWorker(client, worker.id, worker.hostname);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Heartbeat monitor recovery failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client.release();
  }
}

async function recoverJobsForWorker(
  client: import('pg').PoolClient,
  workerId: string,
  hostname: string
): Promise<void> {
  // Find all jobs this worker had in-flight
  const { rows: stuckJobs } = await client.query(
    `SELECT j.id, j.retry_count, j.max_retries, j.name
     FROM jobs j
     INNER JOIN job_executions je ON je.job_id = j.id
     WHERE je.worker_id = $1
       AND je.status IN ('assigned', 'running')
       AND j.status IN ('queued', 'running')`,
    [workerId]
  );

  if (stuckJobs.length === 0) return;

  logger.warn('Recovering stuck jobs from dead worker', {
    workerId,
    hostname,
    jobCount: stuckJobs.length,
  });

  for (const job of stuckJobs) {
    const newRetryCount = job.retry_count + 1;
    const hasRetriesLeft = newRetryCount < job.max_retries;

    if (hasRetriesLeft) {
      // Exponential backoff — same formula as in execution.service.ts
      const baseDelay = Math.min(5 * Math.pow(2, job.retry_count), 300);
      const jitter = Math.random() * 10;
      const delaySeconds = Math.round(baseDelay + jitter);

      // Reset job to pending so the scheduler picks it up again
      await client.query(
        `UPDATE jobs
         SET status = 'pending',
             retry_count = $2,
             scheduled_at = NOW() + INTERVAL '1 second' * $3
         WHERE id = $1`,
        [job.id, newRetryCount, delaySeconds]
      );

      logger.warn('Job recovered and rescheduled', {
        jobId: job.id,
        jobName: job.name,
        attempt: newRetryCount,
        retryInSeconds: delaySeconds,
      });
    } else {
      // No retries left — permanently fail the job
      await client.query(
        `UPDATE jobs
         SET status = 'failed',
             retry_count = $2
         WHERE id = $1`,
        [job.id, newRetryCount]
      );

      logger.error('Job permanently failed after worker crash', {
        jobId: job.id,
        jobName: job.name,
        totalAttempts: newRetryCount,
      });
    }

    // Mark the execution record as timed out with a clear reason
    await client.query(
      `UPDATE job_executions
       SET status = 'timed_out',
           finished_at = NOW(),
           error_message = $2
       WHERE job_id = $1
         AND worker_id = $3
         AND status IN ('assigned', 'running')`,
      [job.id, `Worker ${hostname} stopped sending heartbeats`, workerId]
    );

    // Append to execution logs so the user can see what happened
    await client.query(
      `INSERT INTO execution_logs (job_id, worker_id, level, message)
       VALUES ($1, $2, 'error', $3)`,
      [
        job.id,
        workerId,
        `Worker ${hostname} was marked dead. Job recovered for retry.`,
      ]
    );
  }
}

export function startHeartbeatMonitor(): void {
  const intervalMs = parseInt(
    process.env.HEARTBEAT_MONITOR_INTERVAL_MS ?? '30000'
  );

  logger.info('Heartbeat monitor started', { intervalMs });

  // Run once immediately on startup to recover any jobs
  // that were in-flight when the server last restarted
  recoverDeadWorkers();

  setInterval(recoverDeadWorkers, intervalMs);
}
