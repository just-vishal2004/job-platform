import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { RegisterWorkerRequest } from '@job-platform/types';

function mapWorker(row: Record<string, unknown>) {
  return {
    id: row.id,
    hostname: row.hostname,
    status: row.status,
    lastHeartbeat: row.last_heartbeat,
    registeredAt: row.registered_at,
    metadata: row.metadata,
  };
}

export async function registerWorker(input: RegisterWorkerRequest) {
  const { hostname, metadata = {} } = input;

  const { rows } = await pool.query(
    `INSERT INTO workers (hostname, metadata)
     VALUES ($1, $2)
     RETURNING *`,
    [hostname, metadata]
  );

  logger.info('Worker registered', { workerId: rows[0].id, hostname });
  return mapWorker(rows[0]);
}

export async function heartbeat(workerId: string) {
  // Update last_heartbeat timestamp.
  // We only update if the worker is not dead — a dead worker
  // that somehow sends a heartbeat should not resurrect itself.
  // It must re-register to come back into the pool.
  const { rows } = await pool.query(
    `UPDATE workers
     SET last_heartbeat = NOW()
     WHERE id = $1
       AND status != 'dead'
     RETURNING *`,
    [workerId]
  );

  if (rows.length === 0) return null;
  return mapWorker(rows[0]);
}

export async function deregisterWorker(workerId: string) {
  // Graceful shutdown — mark as dead and free any queued jobs
  // back to pending so the scheduler can reassign them.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Mark worker as dead
    const { rows } = await client.query(
      `UPDATE workers
       SET status = 'dead'
       WHERE id = $1
         AND status != 'dead'
       RETURNING *`,
      [workerId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Return any assigned/running jobs back to pending
    await client.query(
      `UPDATE jobs
       SET status = 'pending',
           retry_count = retry_count + 1
       WHERE id IN (
         SELECT job_id FROM job_executions
         WHERE worker_id = $1
           AND status IN ('assigned', 'running')
       )
       AND retry_count < max_retries`,
      [workerId]
    );

    // Mark those executions as timed_out
    await client.query(
      `UPDATE job_executions
       SET status = 'timed_out',
           finished_at = NOW(),
           error_message = 'Worker deregistered gracefully'
       WHERE worker_id = $1
         AND status IN ('assigned', 'running')`,
      [workerId]
    );

    await client.query('COMMIT');

    logger.info('Worker deregistered', { workerId });
    return mapWorker(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getWorkers() {
  const { rows } = await pool.query(
    `SELECT * FROM workers ORDER BY registered_at DESC`
  );
  return rows.map(mapWorker);
}

export async function getWorkerById(workerId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM workers WHERE id = $1`,
    [workerId]
  );
  if (rows.length === 0) return null;
  return mapWorker(rows[0]);
}
