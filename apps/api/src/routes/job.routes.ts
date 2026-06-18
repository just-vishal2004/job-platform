import { Router, Request, Response } from 'express';
import * as JobService from '../services/job.service';
import { SubmitJobRequest } from '@job-platform/types';

const router = Router();

// POST /api/jobs — Submit a new job
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as SubmitJobRequest;

  // Basic validation — reject obviously bad requests early
  if (!body.name || typeof body.name !== 'string') {
    res.status(400).json({ error: 'name is required and must be a string' });
    return;
  }

  if (body.payload !== undefined && typeof body.payload !== 'object') {
    res.status(400).json({ error: 'payload must be an object' });
    return;
  }

  if (body.priority !== undefined && (body.priority < 1 || body.priority > 10)) {
    res.status(400).json({ error: 'priority must be between 1 and 10' });
    return;
  }

  try {
    const job = await JobService.createJob({
      name: body.name,
      payload: body.payload ?? {},
      priority: body.priority,
      maxRetries: body.maxRetries,
      scheduledAt: body.scheduledAt,
    });

    res.status(201).json({ job });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// GET /api/jobs — List jobs with optional filters
router.get('/', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  const validStatuses = ['pending','queued','running','completed','failed','cancelled'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  try {
    const jobs = await JobService.getJobs({ status, limit, offset });
    res.json({ jobs, count: jobs.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id — Get a single job with its execution history
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await JobService.getJobWithExecutions(req.params.id);

    if (!result) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// DELETE /api/jobs/:id — Cancel a job
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const job = await JobService.cancelJob(req.params.id);

    if (!job) {
      res.status(404).json({
        error: 'Job not found or cannot be cancelled (only pending/queued jobs can be cancelled)',
      });
      return;
    }

    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

export default router;
