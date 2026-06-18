import { Router, Request, Response } from 'express';
import * as WorkerService from '../services/worker.service';
import { RegisterWorkerRequest } from '@job-platform/types';

const router = Router();

// POST /api/workers/register — Worker announces itself to the system
router.post('/register', async (req: Request, res: Response) => {
  const body = req.body as RegisterWorkerRequest;

  if (!body.hostname || typeof body.hostname !== 'string') {
    res.status(400).json({ error: 'hostname is required' });
    return;
  }

  try {
    const worker = await WorkerService.registerWorker({
      hostname: body.hostname,
      metadata: body.metadata ?? {},
    });
    res.status(201).json({ worker });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register worker' });
  }
});

// GET /api/workers — List all workers and their current status
router.get('/', async (_req: Request, res: Response) => {
  try {
    const workers = await WorkerService.getWorkers();
    res.json({ workers, count: workers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// GET /api/workers/:id — Get a single worker
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const worker = await WorkerService.getWorkerById(req.params.id);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    res.json({ worker });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch worker' });
  }
});

// POST /api/workers/:id/heartbeat — Worker signals it is still alive
router.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const worker = await WorkerService.heartbeat(req.params.id);

    if (!worker) {
      // Worker is dead or doesn't exist — tell it to re-register
      res.status(410).json({
        error: 'Worker is no longer active. Please re-register.',
      });
      return;
    }

    res.json({ worker });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// POST /api/workers/:id/deregister — Worker is shutting down gracefully
router.post('/:id/deregister', async (req: Request, res: Response) => {
  try {
    const worker = await WorkerService.deregisterWorker(req.params.id);

    if (!worker) {
      res.status(404).json({ error: 'Worker not found or already dead' });
      return;
    }

    res.json({ worker });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deregister worker' });
  }
});

export default router;
