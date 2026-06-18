import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { startExecution } from '../services/execution.service';

let isRunning = false;

// assignNextJob attempts to pair one pending job with one idle worker.
// Returns true if an assignment was made, false if nothing to do.
async function assignNextJob(): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock one pending job, highest priority first, FIFO within same priority.
    // scheduled_at NULL means "run immediately" — we treat it as the earliest possible time.
    // SKIP LOCKED ensures concurrent scheduler runs never double-assign the same job.
    const { rows: jobRows } = await client.query(
      `SELECT * FROM jobs
       WHERE status = 'pending'
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (jobRows.length === 0) {
      await client.query('ROLLBACK');
      return false; // No pending jobs right now
    }

    // Lock one idle worker.
    // SKIP LOCKED here too — if another scheduler grabbed this worker,
    // we'll take the next one.
    const { rows: workerRows } = await client.query(
      `SELECT * FROM workers
       WHERE status = 'idle'
       ORDER BY last_heartbeat DESC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (workerRows.length === 0) {
      await client.query('ROLLBACK');
      return false; // No idle workers available
    }

    const job = jobRows[0];
    const worker = workerRows[0];
    const attempt = job.retry_count + 1;

    // Assign the job to the worker atomically
    await client.query(
      `UPDATE jobs SET status = 'queued' WHERE id = $1`,
      [job.id]
    );

    await client.query(
      `UPDATE workers SET status = 'busy' WHERE id = $1`,
      [worker.id]
    );

    await client.query('COMMIT');

    // Create execution record outside the lock — the assignment is already
    // committed so this is safe even if it fails (we'd just be missing a log row)
    await startExecution(job.id, worker.id, attempt);

    logger.info('Job assigned to worker', {
      jobId: job.id,
      jobName: job.name,
      workerId: worker.id,
      workerHostname: worker.hostname,
      priority: job.priority,
      attempt,
    });

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Scheduler assignment failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  } finally {
    client.release();
  }
}

// runSchedulerCycle runs assignments in a tight loop until
// there's nothing left to assign in this cycle.
async function runSchedulerCycle(): Promise<void> {
  let assigned = 0;

  while (true) {
    const didAssign = await assignNextJob();
    if (!didAssign) break;
    assigned++;
  }

  if (assigned > 0) {
    logger.info(`Scheduler cycle complete`, { jobsAssigned: assigned });
  }
}

export function startScheduler(): void {
  const intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS ?? '2000');

  logger.info('Scheduler started', { intervalMs });

  setInterval(async () => {
    // Guard against overlapping cycles — if the previous cycle is still
    // running (e.g. DB is slow), skip this tick rather than pile up.
    if (isRunning) return;

    isRunning = true;
    try {
      await runSchedulerCycle();
    } finally {
      isRunning = false;
    }
  }, intervalMs);
}
