import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { connectDatabase } from './db/pool';
import { logger } from './utils/logger';
import jobRoutes from './routes/job.routes';
import workerRoutes from './routes/worker.routes';
import executionRoutes from './routes/execution.routes';
import { startScheduler } from './scheduler/scheduler';
import { startHeartbeatMonitor } from './monitor/heartbeat.monitor';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/workers', executionRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function start() {
  try {
    await connectDatabase();

    startScheduler();
    startHeartbeatMonitor();

    app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

start();
