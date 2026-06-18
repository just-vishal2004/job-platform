import 'dotenv/config';
import { logger } from '../utils/logger';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 15000;

// ---------- HTTP helpers ----------

async function post(path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function get(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  return res.json();
}

// ---------- Job simulation ----------

// This simulates real job execution.
// In a real system this would call external services, run computations, etc.
async function executeJob(
  job: { id: string; name: string; payload: unknown; attempt: number },
  workerId: string
): Promise<void> {
  logger.info('Executing job', {
    jobId: job.id,
    jobName: job.name,
    attempt: job.attempt,
  });

  // Tell the server we've started
  await post(`/api/workers/${workerId}/jobs/${job.id}/start`, { workerId });

  // Simulate work in three stages, reporting progress each time
  const stages = [25, 50, 75, 100];

  for (const percent of stages) {
    // Simulate work taking time — random between 1-3 seconds per stage
    await sleep(1000 + Math.random() * 2000);

    // Randomly fail 20% of jobs to demonstrate retry logic.
    // Only fail on first attempt so we can show recovery too.
    if (percent === 50 && job.attempt === 1 && Math.random() < 0.2) {
      throw new Error(`Simulated failure at ${percent}% for job ${job.name}`);
    }

    await post(`/api/workers/${workerId}/jobs/${job.id}/progress`, {
      workerId,
      percent,
    });

    logger.info('Job progress', {
      jobId: job.id,
      percent,
    });
  }
}

// ---------- Worker lifecycle ----------

async function register(hostname: string): Promise<string> {
  const data = await post('/api/workers/register', {
    hostname,
    metadata: { pid: process.pid },
  });
  return data.worker.id;
}

async function sendHeartbeat(workerId: string): Promise<void> {
  const data = await post(`/api/workers/${workerId}/heartbeat`);

  // 410 Gone means the server considers this worker dead.
  // The correct response is to stop and let the process restart fresh.
  if (data.error) {
    logger.error('Heartbeat rejected — worker marked dead, shutting down');
    process.exit(1);
  }
}

async function pollForJob(workerId: string) {
  const data = await post(`/api/workers/${workerId}/jobs/poll`);
  return data.job ?? null;
}

async function runWorker(hostname: string): Promise<void> {
  logger.info('Worker starting', { hostname });

  const workerId = await register(hostname);
  logger.info('Worker registered', { workerId, hostname });

  // Start heartbeat loop on its own independent interval.
  // This runs even while a job is executing.
  const heartbeatTimer = setInterval(async () => {
    try {
      await sendHeartbeat(workerId);
    } catch (err) {
      logger.warn('Heartbeat failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info('Worker shutting down', { signal });
    clearInterval(heartbeatTimer);
    await post(`/api/workers/${workerId}/deregister`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Poll loop — keep asking for work
  logger.info('Worker ready, polling for jobs', { pollIntervalMs: POLL_INTERVAL_MS });

  while (true) {
    try {
      const job = await pollForJob(workerId);

      if (!job) {
        // No work available — wait before polling again
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      try {
        await executeJob(job, workerId);
        await post(`/api/workers/${workerId}/jobs/${job.id}/complete`, { workerId });
        logger.info('Job completed successfully', { jobId: job.id });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        logger.error('Job execution failed', {
          jobId: job.id,
          error: errorMessage,
        });
        await post(`/api/workers/${workerId}/jobs/${job.id}/fail`, {
          workerId,
          error: errorMessage,
        });
      }

      // Small pause between jobs so we don't hammer the server
      await sleep(500);
    } catch (err) {
      logger.error('Poll loop error', {
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read worker name from command line argument,
// defaulting to a hostname based on process ID
const hostname = process.argv[2] ?? `worker-${process.pid}`;
runWorker(hostname).catch((err) => {
  logger.error('Worker crashed', { error: err.message });
  process.exit(1);
});
