import { JOB_NAMES, remindersQueue } from '@/lib/queue';
import { logger } from '@/config/logger';

export async function scheduleRecurringJobs() {
  // Daily at 08:00 — workout + diet nudges
  await remindersQueue.add(
    JOB_NAMES.WORKOUT_REMINDER,
    {},
    { repeat: { pattern: '0 8 * * *' }, jobId: 'workout-reminder-daily' }
  );
  await remindersQueue.add(
    JOB_NAMES.DIET_REMINDER,
    {},
    { repeat: { pattern: '0 8 * * *' }, jobId: 'diet-reminder-daily' }
  );
  // Every 6 hours — membership expiry check
  await remindersQueue.add(
    JOB_NAMES.MEMBERSHIP_EXPIRY,
    {},
    { repeat: { pattern: '0 */6 * * *' }, jobId: 'membership-expiry-6h' }
  );
  // Hourly — mission ending-soon check
  await remindersQueue.add(
    JOB_NAMES.MISSION_REMINDER,
    {},
    { repeat: { pattern: '0 * * * *' }, jobId: 'mission-reminder-hourly' }
  );

  logger.info('Recurring reminder jobs scheduled');
}
