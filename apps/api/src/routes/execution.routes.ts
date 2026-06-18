import { Router, Request, Response } from 'express';
import * as ExecutionService from '../services/execution.service';
import { pool } from '../db/pool';

const router = Router();

// POST /api/workers/:workerId/jobs/poll
router.post('/:workerId/jobs/poll', async (req: Request, res: Response) => {
  const { workerId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT j.* FROM jobs j
       INNER JOIN job_executions je ON je.job_id = j.id
       WHERE je.worker_id = $1
         AND j.status = 'queued'
         AND je.status = 'assigned'
       ORDER BY je.started_at ASC
       LIMIT 1`,
      [workerId]
    );

    if (rows.length === 0) {
      res.json({ job: null });
      return;
    }

    const job = rows[0];
    res.json({
      job: {
        id: job.id,
        name: job.name,
        payload: job.payload,
        priority: job.priority,
        attempt: job.retry_count,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to poll for job' });
  }
});

// POST /api/workers/:workerId/jobs/:jobId/start
router.post('/:workerId/jobs/:jobId/start', async (req: Request, res: Response) => {
  const { workerId, jobId } = req.params;

  try {
    await pool.query(
      `UPDATE jobs SET status = 'running' WHERE id = $1`,
      [jobId]
    );
    await pool.query(
      `UPDATE job_executions SET status = 'running'
       WHERE job_id = $1 AND worker_id = $2`,
      [jobId, workerId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark job as started' });
  }
});

// POST /api/workers/:workerId/jobs/:jobId/progress
router.post('/:workerId/jobs/:jobId/progress', async (req: Request, res: Response) => {
  const { workerId, jobId } = req.params;
  const { percent } = req.body;

  try {
    await ExecutionService.updateExecutionProgress(jobId, workerId, percent);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// POST /api/workers/:workerId/jobs/:jobId/complete
router.post('/:workerId/jobs/:jobId/complete', async (req: Request, res: Response) => {
  const { workerId, jobId } = req.params;

  try {
    await ExecutionService.completeExecution(jobId, workerId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// POST /api/workers/:workerId/jobs/:jobId/fail
router.post('/:workerId/jobs/:jobId/fail', async (req: Request, res: Response) => {
  const { workerId, jobId } = req.params;
  const { error } = req.body;

  try {
    await ExecutionService.failExecution(jobId, workerId, error ?? 'Unknown error');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record job failure' });
  }
});

export default router;
