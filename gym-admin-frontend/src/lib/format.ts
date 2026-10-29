// Display formatters shared by charts and dashboard tiles.
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// "YYYY-MM-DD" calendar date -> "29 Oct" (no timezone shift).
export const formatDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);
