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
