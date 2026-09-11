import cron from 'node-cron';
import { updateOverdue } from '../modules/work/work.repository.js';
import { cleanupSessions } from '../modules/auth/auth.service.js';
import { logger } from '../lib/logger.js';
import type { Realtime } from '../realtime/gateway.js';
export function startJobs(realtime: Realtime) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const changed = await updateOverdue();
      if (changed.length) {
        await realtime.sync(['tasks', 'projects', 'dashboard']);
        logger.info({ count: changed.length }, 'Updated overdue flags');
      }
      await cleanupSessions();
    } catch (err) {
      logger.error({ err }, 'Scheduled maintenance failed');
    } finally {
      running = false;
    }
  };
  void run();
  const job = cron.schedule('* * * * *', run, { timezone: 'UTC', noOverlap: true });
  return () => job.stop();
}
