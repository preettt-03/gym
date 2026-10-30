// The gym runs on Indian time, and members think of "today" as an IST
// calendar day regardless of the server's timezone (containers run in UTC).
export const GYM_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" of the IST day containing `instant`.
export function gymDateKey(instant = new Date()) {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// [start, end] UTC instants of an IST calendar day ("YYYY-MM-DD"; default today).
export function gymDayRange(dateKey = gymDateKey()) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
  return { dateKey, start, end: new Date(start.getTime() + DAY_MS - 1) };
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

// [start, end) UTC instants of an IST day / Monday-start week / month.
// `offset` steps back whole periods (1 = yesterday / last week / last month).
export function gymPeriodRange(period: LeaderboardPeriod, offset = 0, now = new Date()) {
  // Year 9999, not JS's max date: Postgres and Prisma can't take dates past that.
  if (period === 'all-time') return { start: new Date(0), end: new Date(Date.UTC(9999, 0, 1)) };
  const [y, m, d] = gymDateKey(now).split('-').map(Number);
  let startUtc: number;
  let endUtc: number;
  if (period === 'daily') {
    startUtc = Date.UTC(y, m - 1, d - offset);
    endUtc = Date.UTC(y, m - 1, d - offset + 1);
  } else if (period === 'weekly') {
    const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
    startUtc = Date.UTC(y, m - 1, d - weekday - offset * 7);
    endUtc = startUtc + 7 * DAY_MS;
  } else {
    startUtc = Date.UTC(y, m - 1 - offset, 1);
    endUtc = Date.UTC(y, m - offset, 1);
  }
  return { start: new Date(startUtc - IST_OFFSET_MS), end: new Date(endUtc - IST_OFFSET_MS) };
}
