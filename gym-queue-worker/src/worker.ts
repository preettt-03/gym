import { Job, Worker } from 'bullmq';
import { bullConnection } from '@/lib/redis';
import { JOB_NAMES, QUEUE_NAME } from '@/lib/queue';
import { runWorkoutReminderJob } from '@/jobs/workout-reminder.job';
import { runMembershipExpiryJob } from '@/jobs/membership-expiry.job';
import { runMissionReminderJob } from '@/jobs/mission-reminder.job';
import { runDietReminderJob } from '@/jobs/diet-reminder.job';
import { logger } from '@/config/logger';

async function processJob(job: Job) {
  logger.info(`Processing job: ${job.name}`);
  switch (job.name) {
    case JOB_NAMES.WORKOUT_REMINDER:
      return runWorkoutReminderJob();
    case JOB_NAMES.MEMBERSHIP_EXPIRY:
      return runMembershipExpiryJob();
    case JOB_NAMES.MISSION_REMINDER:
      return runMissionReminderJob();
    case JOB_NAMES.DIET_REMINDER:
      return runDietReminderJob();
    default:
      logger.warn(`Unknown job name: ${job.name}`);
      return null;
  }
}

export function createReminderWorker() {
  const worker = new Worker(QUEUE_NAME, processJob, { connection: bullConnection });

  worker.on('completed', (job, result) => {
    logger.info(`Job ${job.name} completed`, { result });
  });
  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.name} failed`, { err: err.message });
  });

  return worker;
}
