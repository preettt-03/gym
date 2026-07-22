import { scheduleRecurringJobs } from '@/scheduler';
import { createReminderWorker } from '@/worker';
import { runWorkoutReminderJob } from '@/jobs/workout-reminder.job';
import { runMembershipExpiryJob } from '@/jobs/membership-expiry.job';
import { runMissionReminderJob } from '@/jobs/mission-reminder.job';
import { runDietReminderJob } from '@/jobs/diet-reminder.job';
import { logger } from '@/config/logger';

const RUN_ONCE_JOBS: Record<string, () => Promise<{ sent: number }>> = {
  'workout-reminder': runWorkoutReminderJob,
  'membership-expiry': runMembershipExpiryJob,
  'mission-reminder': runMissionReminderJob,
  'diet-reminder': runDietReminderJob,
};

async function main() {
  // `npm run dev -- --run-once=workout-reminder` runs a single job immediately and exits,
  // without waiting for its cron schedule — useful for local testing.
  const runOnceArg = process.argv.find((arg) => arg.startsWith('--run-once='));
  if (runOnceArg) {
    const jobName = runOnceArg.split('=')[1];
    const jobFn = RUN_ONCE_JOBS[jobName];
    if (!jobFn) {
      logger.error(`Unknown job for --run-once: ${jobName}`);
      process.exit(1);
    }
    const result = await jobFn();
    logger.info(`Run-once job "${jobName}" finished`, { result });
    process.exit(0);
  }

  const worker = createReminderWorker();
  await scheduleRecurringJobs();
  logger.info('gym-queue-worker started');

  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully`);
    await worker.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal error starting queue worker', { err });
  process.exit(1);
});
