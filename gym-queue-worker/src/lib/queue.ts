import { Queue } from 'bullmq';
import { bullConnection } from '@/lib/redis';

export const QUEUE_NAME = 'reminders';

export const remindersQueue = new Queue(QUEUE_NAME, { connection: bullConnection });

export const JOB_NAMES = {
  WORKOUT_REMINDER: 'workout-reminder',
  MEMBERSHIP_EXPIRY: 'membership-expiry',
  MISSION_REMINDER: 'mission-reminder',
  DIET_REMINDER: 'diet-reminder',
} as const;
