import { MembershipStatus, NotificationType, OtpPurpose, PaymentGateway, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { gymDateKey } from '@/lib/gym-time';
import { activateMembership, getEffectiveMembership, resumeMembership } from '@/features/memberships/memberships.service';
import { adminCheckIn } from '@/features/attendance/attendance.service';
import { createNotification } from '@/features/notifications/notifications.service';
import { resendOtp } from '@/features/auth/auth.service';

const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVE_AFTER_DAYS = 7;
export const EXPIRY_WARNING_DAYS = 7;
const HEATMAP_DAYS = 91;
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function assertMember(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, email: true, name: true, trainerId: true, isEmailVerified: true, createdAt: true } });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

// ---------------------------------------------------------------------------
// Read model for the member page (merged into getUserDetail)
// ---------------------------------------------------------------------------

export async function getMemberInsights(id: string, createdAt: Date) {
  const now = new Date();
  const since = new Date(now.getTime() - HEATMAP_DAYS * DAY_MS);

  const [membership, lastVisit, visits, streak, badges, missions, weights, ptRecent, workoutAssignments, dietAssignments] = await Promise.all([
    getEffectiveMembership(id),
    prisma.attendance.findFirst({ where: { userId: id }, orderBy: { checkInAt: 'desc' }, select: { checkInAt: true } }),
    prisma.attendance.findMany({ where: { userId: id, checkInAt: { gte: since } }, select: { checkInAt: true } }),
    prisma.userStreak.findUnique({ where: { userId: id }, select: { currentStreak: true, longestStreak: true } }),
    prisma.userBadge.findMany({ where: { userId: id }, orderBy: { awardedAt: 'desc' }, select: { awardedAt: true, badge: { select: { id: true, name: true, iconUrl: true } } } }),
    prisma.mission.findMany({
      where: { isActive: true, deletedAt: null, startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, progress: { where: { userId: id }, select: { isCompleted: true } } },
    }),
    prisma.weightLog.findMany({ where: { userId: id, loggedAt: { gte: new Date(now.getTime() - 365 * DAY_MS) } }, orderBy: { loggedAt: 'asc' }, take: 200, select: { weightKg: true, loggedAt: true } }),
    prisma.ptSession.findMany({ where: { userId: id }, orderBy: { completedAt: 'desc' }, take: 5, select: { id: true, completedAt: true, trainer: { select: { name: true, email: true } } } }),
    prisma.workoutPlanAssignment.findMany({
      where: { userId: id, isActive: true, plan: { deletedAt: null } },
      orderBy: { assignedAt: 'desc' },
      select: { id: true, assignedAt: true, plan: { select: { id: true, title: true, difficulty: true, estimatedMinutes: true, days: { select: { weekNumber: true, isRestDay: true } } } } },
    }),
    prisma.dietPlanAssignment.findMany({
      where: { userId: id, isActive: true, dietPlan: { deletedAt: null } },
      orderBy: { assignedAt: 'desc' },
      select: {
        id: true,
        assignedAt: true,
        dietPlan: {
          select: {
            id: true,
            title: true,
            estimatedCalories: true,
            meals: { select: { items: { select: { quantityGrams: true, food: { select: { caloriesPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true } } } } } },
          },
        },
      },
    }),
  ]);

  // Membership summary with the progress the card draws.
  let membershipSummary = null;
  if (membership) {
    const end = membership.status === MembershipStatus.FROZEN && membership.frozenAt ? membership.frozenAt : now;
    membershipSummary = {
      id: membership.id,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      frozenAt: membership.frozenAt,
      resumeAt: membership.resumeAt,
      plan: { id: membership.plan.id, name: membership.plan.name, durationDays: membership.plan.durationDays, price: membership.plan.price },
      totalDays: Math.max(1, Math.round((membership.endDate.getTime() - membership.startDate.getTime()) / DAY_MS)),
      daysRemaining: Math.max(0, Math.ceil((membership.endDate.getTime() - end.getTime()) / DAY_MS)),
    };
  }

  // Retention alerts: absent for a while, or about to / just lapsed.
  const alerts: { kind: 'INACTIVE' | 'EXPIRING' | 'EXPIRED'; days: number; date: Date | null }[] = [];
  const reference = lastVisit?.checkInAt ?? (membershipSummary ? membership!.startDate : null);
  if (reference && membershipSummary?.status === MembershipStatus.ACTIVE) {
    const absent = daysBetween(reference, now);
    if (absent >= INACTIVE_AFTER_DAYS) alerts.push({ kind: 'INACTIVE', days: absent, date: lastVisit?.checkInAt ?? null });
  }
  if (membershipSummary?.status === MembershipStatus.ACTIVE && membershipSummary.daysRemaining <= EXPIRY_WARNING_DAYS) {
    alerts.push({ kind: 'EXPIRING', days: membershipSummary.daysRemaining, date: membership!.endDate });
  }
  if (membershipSummary?.status === MembershipStatus.EXPIRED && daysBetween(membership!.endDate, now) <= 30) {
    alerts.push({ kind: 'EXPIRED', days: daysBetween(membership!.endDate, now), date: membership!.endDate });
  }

  // Check-ins per IST day for the heatmap, plus the current run of consecutive gym days.
  const perDay = new Map<string, number>();
  for (const v of visits) perDay.set(gymDateKey(v.checkInAt), (perDay.get(gymDateKey(v.checkInAt)) ?? 0) + 1);
  let visitStreak = 0;
  for (let d = 0; d < HEATMAP_DAYS; d++) {
    const key = gymDateKey(new Date(now.getTime() - d * DAY_MS));
    if (perDay.has(key)) visitStreak++;
    else if (d > 0) break; // today may simply not have happened yet
  }

  const plans = {
    workout: workoutAssignments.map((a) => {
      const weeks = new Set(a.plan.days.map((d) => d.weekNumber)).size || 1;
      return {
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        id: a.plan.id,
        title: a.plan.title,
        difficulty: a.plan.difficulty,
        estimatedMinutes: a.plan.estimatedMinutes,
        daysPerWeek: Math.round(a.plan.days.filter((d) => !d.isRestDay).length / weeks),
      };
    }),
    diet: dietAssignments.map((a) => {
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      for (const item of a.dietPlan.meals.flatMap((m) => m.items)) {
        const f = item.quantityGrams / 100;
        totals.calories += item.food.caloriesPer100g * f;
        totals.protein += item.food.proteinPer100g * f;
        totals.carbs += item.food.carbsPer100g * f;
        totals.fat += item.food.fatPer100g * f;
      }
      return {
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        id: a.dietPlan.id,
        title: a.dietPlan.title,
        calories: Math.round(a.dietPlan.estimatedCalories ?? totals.calories),
        macros: { protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fat: Math.round(totals.fat) },
      };
    }),
  };

  return {
    membership: membershipSummary,
    alerts,
    lastVisitAt: lastVisit?.checkInAt ?? null,
    memberForDays: daysBetween(createdAt, now),
    attendanceHeatmap: { days: HEATMAP_DAYS, counts: Object.fromEntries(perDay), streak: visitStreak },
    weightSeries: weights,
    gamification: {
      streak: streak ?? { currentStreak: 0, longestStreak: 0 },
      badges: badges.map((b) => ({ ...b.badge, awardedAt: b.awardedAt })),
      missions: { active: missions.length, completed: missions.filter((m) => m.progress[0]?.isCompleted).length },
    },
    ptRecent,
    plans,
  };
}

// ---------------------------------------------------------------------------
// Profile, tags, locker / RFID
// ---------------------------------------------------------------------------

export async function updateMemberProfile(id: string, data: Prisma.UserUpdateInput) {
  await assertMember(id);
  await prisma.user.update({ where: { id }, data });
}

/** Trimmed, de-duplicated (case-insensitively) tag list. */
export async function setTags(id: string, tags: string[]) {
  await assertMember(id);
  const seen = new Set<string>();
  const clean = tags.map((t) => t.trim()).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  await prisma.user.update({ where: { id }, data: { tags: clean } });
  return clean;
}

export async function setFacility(id: string, data: { lockerNumber?: string | null; rfidTagId?: string | null }) {
  await assertMember(id);
  try {
    await prisma.user.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const field = String((err.meta?.target as string[] | undefined)?.join(',') ?? '');
      const taken = await prisma.user.findFirst({
        where: field.includes('locker') ? { lockerNumber: data.lockerNumber } : { rfidTagId: data.rfidTagId },
        select: { name: true, email: true },
      });
      throw new AppError(`${field.includes('locker') ? `Locker ${data.lockerNumber}` : 'That RFID tag'} is already assigned to ${taken?.name ?? taken?.email ?? 'another member'}`, 409);
    }
    throw err;
  }
}

export async function manualCheckIn(adminId: string, id: string) {
  await assertMember(id);
  return adminCheckIn(adminId, id);
}

// ---------------------------------------------------------------------------
// Membership lifecycle and desk billing
// ---------------------------------------------------------------------------

async function currentMembership(id: string) {
  await assertMember(id);
  const m = await getEffectiveMembership(id);
  if (!m) throw new AppError('This member has no membership yet — record a payment to start one', 404);
  return m;
}

export async function extendMembership(id: string, days: number) {
  const m = await currentMembership(id);
  if (m.status !== MembershipStatus.ACTIVE && m.status !== MembershipStatus.FROZEN) {
    throw new AppError('Only an active or frozen membership can be extended — renew it instead', 409);
  }
  return prisma.membership.update({ where: { id: m.id }, data: { endDate: new Date(m.endDate.getTime() + days * DAY_MS) } });
}

export async function freezeMembership(id: string, resumeAt: Date) {
  const m = await currentMembership(id);
  if (m.status !== MembershipStatus.ACTIVE) throw new AppError('Only an active membership can be frozen', 409);
  if (resumeAt.getTime() <= Date.now()) throw new AppError('Pick a resume date in the future', 422);
  return prisma.membership.update({ where: { id: m.id }, data: { status: MembershipStatus.FROZEN, frozenAt: new Date(), resumeAt } });
}

export async function unfreezeMembership(id: string) {
  const m = await currentMembership(id);
  if (m.status !== MembershipStatus.FROZEN) throw new AppError('This membership is not frozen', 409);
  return resumeMembership(m.id);
}

export async function cancelMembership(id: string) {
  const m = await currentMembership(id);
  if (m.status === MembershipStatus.CANCELLED || m.status === MembershipStatus.EXPIRED) throw new AppError('This membership has already ended', 409);
  return prisma.membership.update({ where: { id: m.id }, data: { status: MembershipStatus.CANCELLED, frozenAt: null, resumeAt: null } });
}

/** Desk payment that starts, renews or changes the plan (renewals stack onto the current end date). */
export async function recordPayment(
  adminId: string,
  id: string,
  input: { planId: string; amount: number; method: PaymentGateway; reference?: string | null; note?: string | null }
) {
  await assertMember(id);
  const reference = input.reference || `DESK-${Date.now().toString(36).toUpperCase()}`;
  const result = await activateMembership(id, input.planId, input.amount, input.method, reference, undefined, { recordedById: adminId, note: input.note });
  return result.payment;
}

export async function listPayments(id: string, pagination: PaginationParams) {
  await assertMember(id);
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      select: { id: true, amount: true, currency: true, status: true, gateway: true, invoiceNumber: true, gatewayReferenceId: true, recordedById: true, note: true, createdAt: true, plan: { select: { name: true } } },
    }),
    prisma.payment.count({ where: { userId: id } }),
  ]);
  return { items: items.map(({ gatewayReferenceId, recordedById, ...p }) => ({ ...p, reference: recordedById ? gatewayReferenceId : null, desk: Boolean(recordedById) })), pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) } };
}

export async function listVisits(id: string, pagination: PaginationParams) {
  await assertMember(id);
  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: id },
      orderBy: { checkInAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      select: { id: true, checkInAt: true, checkOutAt: true, durationMinutes: true, method: true, approvedByAdmin: { select: { name: true, email: true } } },
    }),
    prisma.attendance.count({ where: { userId: id } }),
  ]);
  return { items, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) } };
}

// ---------------------------------------------------------------------------
// Personal training
// ---------------------------------------------------------------------------

export async function setPtPackage(id: string, total: number) {
  await assertMember(id);
  const { ptSessionsUsed } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { ptSessionsUsed: true } });
  if (total < ptSessionsUsed) throw new AppError(`${ptSessionsUsed} sessions are already used — the package can't be smaller than that`, 422);
  await prisma.user.update({ where: { id }, data: { ptSessionsTotal: total } });
}

export async function completePtSession(adminId: string, id: string) {
  const member = await assertMember(id);
  const session = await prisma.$transaction(async (tx) => {
    const { ptSessionsUsed, ptSessionsTotal } = await tx.user.findUniqueOrThrow({ where: { id }, select: { ptSessionsUsed: true, ptSessionsTotal: true } });
    if (ptSessionsUsed >= ptSessionsTotal) throw new AppError('No PT sessions left — add more to the package first', 409);
    // Conditional on the value we read, so two quick clicks can't over-count.
    const { count } = await tx.user.updateMany({ where: { id, ptSessionsUsed }, data: { ptSessionsUsed: { increment: 1 } } });
    if (count !== 1) throw new AppError('Someone else just updated this — refresh and try again', 409);
    return tx.ptSession.create({ data: { userId: id, trainerId: member.trainerId, recordedById: adminId } });
  });

  const name = member.name ?? member.email;
  if (member.trainerId) {
    void createNotification(member.trainerId, NotificationType.SYSTEM, 'PT session logged', `A session with ${name} was marked complete.`, { memberId: id }).catch(() => undefined);
  }
  void createNotification(id, NotificationType.SYSTEM, 'PT session recorded', 'Your personal training session was logged. Keep it up!').catch(() => undefined);
  return session;
}

// ---------------------------------------------------------------------------
// Nudges and account security
// ---------------------------------------------------------------------------

const NUDGES = {
  INACTIVE: { type: NotificationType.WORKOUT_REMINDER, title: 'We miss you at the gym!', body: "It's been a while since your last workout. Drop in today — your coach is ready for you." },
  EXPIRING: { type: NotificationType.MEMBERSHIP_EXPIRY, title: 'Your membership is ending soon', body: 'Renew now to keep training without a break. Visit the front desk or renew in the app.' },
} as const;

export async function sendNudge(id: string, kind: keyof typeof NUDGES) {
  await assertMember(id);
  const nudge = NUDGES[kind];
  // One of each kind per day, so a double click doesn't spam the member.
  const recent = await prisma.notification.findFirst({ where: { userId: id, title: nudge.title, createdAt: { gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) } } });
  if (recent) throw new AppError('This reminder was already sent in the last 24 hours', 429);
  return createNotification(id, nudge.type, nudge.title, nudge.body);
}

export async function revokeSessions(id: string) {
  await assertMember(id);
  const { count } = await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  return count;
}

export async function resendVerification(id: string) {
  const user = await assertMember(id);
  if (user.isEmailVerified) throw new AppError('This email is already verified', 409);
  await resendOtp(user.email, OtpPurpose.EMAIL_VERIFICATION);
  return user.email;
}

// ---------------------------------------------------------------------------
// Staff notes
// ---------------------------------------------------------------------------

const NOTE_SELECT = { id: true, body: true, followUpDate: true, isDone: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true, email: true } } } satisfies Prisma.StaffNoteSelect;

export async function listNotes(id: string) {
  await assertMember(id);
  return prisma.staffNote.findMany({ where: { userId: id }, orderBy: [{ isDone: 'asc' }, { createdAt: 'desc' }], take: 100, select: NOTE_SELECT });
}

export async function addNote(authorId: string, id: string, body: string, followUpDate?: Date | null) {
  await assertMember(id);
  return prisma.staffNote.create({ data: { userId: id, authorId, body, followUpDate }, select: NOTE_SELECT });
}

export async function updateNote(id: string, noteId: string, data: { body?: string; followUpDate?: Date | null; isDone?: boolean }) {
  const note = await prisma.staffNote.findFirst({ where: { id: noteId, userId: id }, select: { id: true } });
  if (!note) throw new AppError('Note not found', 404);
  return prisma.staffNote.update({ where: { id: noteId }, data, select: NOTE_SELECT });
}

export async function deleteNote(id: string, noteId: string) {
  const { count } = await prisma.staffNote.deleteMany({ where: { id: noteId, userId: id } });
  if (!count) throw new AppError('Note not found', 404);
}

// ---------------------------------------------------------------------------
// Medical details (revealed on demand; each reveal is in the audit log)
// ---------------------------------------------------------------------------

export async function revealMedical(id: string) {
  await assertMember(id);
  const [user, views] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id }, select: { medicalConditions: true, allergies: true, medicalNotes: true } }),
    prisma.auditLog.findMany({
      where: { entityType: 'users', entityId: id, path: { endsWith: '/medical/reveal' }, statusCode: { lt: 400 } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { createdAt: true, admin: { select: { name: true, email: true } } },
    }),
  ]);
  return { ...user, viewLog: views.map((v) => ({ at: v.createdAt, by: v.admin.name ?? v.admin.email })) };
}

export async function updateMedical(id: string, data: { medicalConditions?: string[]; allergies?: string[]; medicalNotes?: string | null }) {
  await assertMember(id);
  await prisma.user.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Unified activity timeline
// ---------------------------------------------------------------------------

type TimelineItem = { id: string; kind: 'CHECK_IN' | 'WORKOUT' | 'PAYMENT' | 'PLAN' | 'PT' | 'ADMIN'; at: Date; title: string; detail?: string | null };

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', RAZORPAY: 'Razorpay', STRIPE: 'Stripe', WALLET: 'Wallet' };

// Turns an audit entry about this member into a readable line; null = shown elsewhere / not interesting.
function describeAdminAction(path: string, method: string, details: Prisma.JsonValue): string | null {
  const d = (details ?? {}) as Record<string, unknown>;
  const reason = typeof d.reason === 'string' && d.reason ? ` — “${d.reason}”` : '';
  const tail = path.replace(/^\/api\/v1\/admin\/users\/[^/]+/, '');
  if (tail === '' && method === 'PATCH') {
    const parts = [d.role && `role → ${d.role}`, d.accountStatus && `status → ${d.accountStatus}`, 'trainerId' in d && (d.trainerId ? 'trainer changed' : 'trainer removed')].filter(Boolean);
    return parts.length ? `Account updated: ${parts.join(', ')}${reason}` : null;
  }
  const map: Record<string, string> = {
    '/membership/extend': `Membership extended by ${d.days} days`,
    '/membership/freeze': 'Membership frozen',
    '/membership/unfreeze': 'Membership resumed',
    '/membership/cancel': 'Membership cancelled',
    '/tags': 'Tags updated',
    '/profile': 'Profile edited',
    '/facility': 'Locker / RFID updated',
    '/pt/package': `PT package set to ${d.total} sessions`,
    '/medical': 'Medical details edited',
    '/medical/reveal': 'Medical details viewed',
    '/sessions/revoke': 'Signed out of all devices',
    '/reset-password': 'Password reset email sent',
    '/resend-verification': 'Verification email re-sent',
    '/nudge': `Reminder sent (${String(d.kind ?? '').toLowerCase()})`,
  };
  return map[tail] ? map[tail] + reason : null;
}

export async function getTimeline(id: string, before?: Date, limit = 25) {
  await assertMember(id);
  const at = before ? { lt: before } : undefined;
  const [visits, workouts, payments, workoutPlans, dietPlans, pt, audits] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: id, checkInAt: at }, orderBy: { checkInAt: 'desc' }, take: limit, select: { id: true, checkInAt: true, durationMinutes: true, method: true } }),
    prisma.workoutLog.findMany({ where: { userId: id, completedAt: { not: null, ...(at ?? {}) } }, orderBy: { completedAt: 'desc' }, take: limit, select: { id: true, completedAt: true, plan: { select: { title: true } }, day: { select: { title: true } } } }),
    prisma.payment.findMany({ where: { userId: id, createdAt: at }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, createdAt: true, amount: true, status: true, gateway: true, plan: { select: { name: true } } } }),
    prisma.workoutPlanAssignment.findMany({ where: { userId: id, assignedAt: at }, orderBy: { assignedAt: 'desc' }, take: limit, select: { id: true, assignedAt: true, isActive: true, plan: { select: { title: true } } } }),
    prisma.dietPlanAssignment.findMany({ where: { userId: id, assignedAt: at }, orderBy: { assignedAt: 'desc' }, take: limit, select: { id: true, assignedAt: true, isActive: true, dietPlan: { select: { title: true } } } }),
    prisma.ptSession.findMany({ where: { userId: id, completedAt: at }, orderBy: { completedAt: 'desc' }, take: limit, select: { id: true, completedAt: true, trainer: { select: { name: true, email: true } } } }),
    prisma.auditLog.findMany({
      where: { entityType: 'users', entityId: id, createdAt: at, statusCode: { lt: 400 } },
      orderBy: { createdAt: 'desc' },
      take: limit * 2,
      select: { id: true, createdAt: true, path: true, method: true, details: true, admin: { select: { name: true, email: true } } },
    }),
  ]);

  const items: TimelineItem[] = [
    ...visits.map((v) => ({ id: `v-${v.id}`, kind: 'CHECK_IN' as const, at: v.checkInAt, title: 'Checked in', detail: [v.method === 'ADMIN_APPROVED' ? 'at the desk' : v.method === 'QR' ? 'by QR' : 'by RFID', v.durationMinutes ? `${v.durationMinutes} min` : null].filter(Boolean).join(' · ') })),
    ...workouts.map((w) => ({ id: `w-${w.id}`, kind: 'WORKOUT' as const, at: w.completedAt!, title: 'Workout completed', detail: [w.plan?.title, w.day?.title].filter(Boolean).join(' · ') || null })),
    ...payments.map((p) => ({ id: `p-${p.id}`, kind: 'PAYMENT' as const, at: p.createdAt, title: `${p.status === 'COMPLETED' ? 'Paid' : p.status.charAt(0) + p.status.slice(1).toLowerCase()} ${money(p.amount)}`, detail: `${p.plan.name} · ${METHOD_LABEL[p.gateway] ?? p.gateway}` })),
    ...workoutPlans.map((a) => ({ id: `wp-${a.id}`, kind: 'PLAN' as const, at: a.assignedAt, title: 'Workout plan assigned', detail: `${a.plan.title}${a.isActive ? '' : ' (later removed)'}` })),
    ...dietPlans.map((a) => ({ id: `dp-${a.id}`, kind: 'PLAN' as const, at: a.assignedAt, title: 'Diet plan assigned', detail: `${a.dietPlan.title}${a.isActive ? '' : ' (later removed)'}` })),
    ...pt.map((s) => ({ id: `pt-${s.id}`, kind: 'PT' as const, at: s.completedAt, title: 'PT session completed', detail: s.trainer ? `with ${s.trainer.name ?? s.trainer.email}` : null })),
    ...audits.flatMap((a) => {
      const title = describeAdminAction(a.path, a.method, a.details);
      return title ? [{ id: `a-${a.id}`, kind: 'ADMIN' as const, at: a.createdAt, title, detail: `by ${a.admin.name ?? a.admin.email}` }] : [];
    }),
  ]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .slice(0, limit);

  return { items, nextBefore: items.length === limit ? items[items.length - 1].at : null };
}
