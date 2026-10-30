import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Hourglass,
  IdCard,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { deleteUser, sendPasswordReset, updateUser } from "@/lib/api";
import {
  manualCheckIn,
  resendVerification,
  revokeSessions,
  sendNudge,
  setMemberTags,
  updateMemberProfile,
  type MemberDetail,
  type ProfileInput,
} from "@/lib/member-api";
import { fmtDate, useMemberAction, whatsAppLink } from "@/lib/member-ui";
import { Avatar, RoleBadge, StatusBadge } from "@/components/user-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-message";
import { apiErrorMessage } from "@/hooks/use-toast";
import { Pill, ReasonDialog } from "@/components/member/shared";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAG_SUGGESTIONS = ["VIP", "Fee pending", "Knee issue", "Back issue", "Morning batch", "Evening batch", "Student", "New joinee"];

function firstName(m: MemberDetail) {
  return displayName(m).split(/[\s@]/)[0];
}

// ---------------------------------------------------------------------------

export function RiskBanner({ member }: { member: MemberDetail }) {
  const nudge = useMemberAction(member.id, (kind: "INACTIVE" | "EXPIRING") => sendNudge(member.id, kind), {
    success: "Reminder sent to the member's app",
    error: "Could not send the reminder",
  });
  if (!member.alerts.length) return null;

  return (
    <div className="flex flex-col gap-2" role="status">
      {member.alerts.map((alert) => {
        const inactive = alert.kind === "INACTIVE";
        const text = inactive
          ? `Absent for ${alert.days} days${alert.date ? ` · last visit ${fmtDate.format(new Date(alert.date))}` : " · hasn't visited yet"}`
          : alert.kind === "EXPIRING"
            ? alert.days === 0
              ? "Membership expires today"
              : `Membership expires in ${alert.days} day${alert.days === 1 ? "" : "s"} · ${fmtDate.format(new Date(alert.date!))}`
            : `Membership expired ${alert.days === 0 ? "today" : `${alert.days} day${alert.days === 1 ? "" : "s"} ago`}`;
        const wa = inactive
          ? `Hi ${firstName(member)}, we've missed you at King's Fitness! Drop in this week — your coach is ready for you. 💪`
          : `Hi ${firstName(member)}, your King's Fitness membership ${alert.kind === "EXPIRED" ? "has expired" : `ends on ${fmtDate.format(new Date(alert.date!))}`}. Renew at the desk to keep training without a break.`;
        const Icon = inactive ? AlertTriangle : Hourglass;
        return (
          <div
            key={alert.kind}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center",
              alert.kind === "EXPIRED" ? "border-danger/40 bg-danger/10" : "border-[#fab219]/40 bg-[#fab219]/10"
            )}
          >
            <span className="flex flex-1 items-center gap-2.5 text-sm font-medium">
              <Icon className={cn("h-5 w-5 shrink-0", alert.kind === "EXPIRED" ? "text-danger" : "text-[#fab219]")} />
              {text}
            </span>
            <div className="flex flex-wrap gap-2">
              {member.phone && (
                <a href={whatsAppLink(member.phone, wa)} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="glass">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
              {alert.kind !== "EXPIRED" && (
                <Button size="sm" variant="glass" disabled={nudge.isPending} onClick={() => nudge.mutate(inactive ? "INACTIVE" : "EXPIRING")}>
                  Send app reminder
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TagsEditor({ member }: { member: MemberDetail }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const save = useMemberAction(member.id, (tags: string[]) => setMemberTags(member.id, tags), { success: "Tags updated", error: "Could not update tags" });
  const has = (t: string) => member.tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const add = (t: string) => {
    const tag = t.trim();
    if (tag && !has(tag) && member.tags.length < 12) save.mutate([...member.tags, tag]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {member.tags.map((t) => (
        <Pill key={t} tone="gold">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} className="rounded-full hover:text-foreground" onClick={() => save.mutate(member.tags.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </Pill>
      ))}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            maxLength={24}
            list="tag-suggestions"
            aria-label="New tag"
            placeholder="Tag…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add(draft);
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => (draft ? add(draft) : setAdding(false))}
            style={{ outline: "none" }}
            className="h-6 w-28 rounded-full border border-gold/40 bg-transparent px-2.5 text-xs"
          />
          <datalist id="tag-suggestions">
            {TAG_SUGGESTIONS.filter((t) => !has(t)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </span>
      ) : (
        member.tags.length < 12 && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted hover:border-gold/40 hover:text-foreground">
            <Plus className="h-3 w-3" /> Tag
          </button>
        )
      )}
      {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
    </div>
  );
}

// ---------------------------------------------------------------------------

type ProfileForm = Record<"name" | "phone" | "alternatePhone" | "age" | "gender" | "heightCm" | "targetWeightKg" | "emergencyContactName" | "emergencyContactPhone" | "emergencyContactRelation", string>;

function EditProfileDialog({ member, open, onClose }: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const initial = (): ProfileForm => ({
    name: member.name ?? "",
    phone: member.phone ?? "",
    alternatePhone: member.alternatePhone ?? "",
    age: member.age ? String(member.age) : "",
    gender: member.gender ?? "",
    heightCm: member.heightCm ? String(member.heightCm) : "",
    targetWeightKg: member.targetWeightKg ? String(member.targetWeightKg) : "",
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhone: member.emergencyContactPhone ?? "",
    emergencyContactRelation: member.emergencyContactRelation ?? "",
  });
  const [form, setForm] = useState<ProfileForm>(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm(initial());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMemberAction(member.id, (input: ProfileInput) => updateMemberProfile(member.id, input), {
    success: "Profile updated",
    error: "Could not save the profile",
    onDone: onClose,
  });

  const num = (v: string) => (v.trim() ? Number(v) : null);
  const submit = () => {
    setError(null);
    if (!form.name.trim()) return setError("Name is required");
    for (const [key, label] of [["age", "Age"], ["heightCm", "Height"], ["targetWeightKg", "Target weight"]] as const) {
      if (form[key].trim() && !Number.isFinite(Number(form[key]))) return setError(`${label} must be a number`);
    }
    save.mutate(
      {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        alternatePhone: form.alternatePhone.trim() || null,
        age: num(form.age),
        gender: (form.gender || null) as ProfileInput["gender"],
        heightCm: num(form.heightCm),
        targetWeightKg: num(form.targetWeightKg),
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        emergencyContactRelation: form.emergencyContactRelation.trim() || null,
      },
      { onError: (err) => setError(apiErrorMessage(err, "Could not save the profile")) }
    );
  };

  const field = (key: keyof ProfileForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`pf-${key}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <Input id={`pf-${key}`} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={save.isPending ? () => {} : onClose}
      size="lg"
      title="Edit member details"
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="profile-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </>
      }
    >
      <form
        id="profile-form"
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Full name", { "data-autofocus": true, maxLength: 80 } as React.InputHTMLAttributes<HTMLInputElement>)}
          {field("phone", "Phone", { inputMode: "tel", placeholder: "+91 98765 43210" })}
          {field("alternatePhone", "Alternate phone", { inputMode: "tel" })}
          {field("age", "Age", { inputMode: "numeric" })}
          <div>
            <label htmlFor="pf-gender" className="mb-1.5 block text-sm font-medium">
              Sex
            </label>
            <Select
              id="pf-gender"
              value={form.gender}
              onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
              options={[
                { value: "", label: "Not set" },
                { value: "MALE", label: "Male" },
                { value: "FEMALE", label: "Female" },
                { value: "OTHER", label: "Other" },
              ]}
            />
          </div>
          {field("heightCm", "Height (cm)", { inputMode: "decimal" })}
          {field("targetWeightKg", "Target weight (kg)", { inputMode: "decimal" })}
        </div>
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Emergency contact</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("emergencyContactName", "Contact name", { maxLength: 80 })}
            {field("emergencyContactPhone", "Contact phone", { inputMode: "tel" })}
            {field("emergencyContactRelation", "Relation", { maxLength: 40, placeholder: "e.g. Mother" })}
          </div>
        </fieldset>
        <FormAlert message={error} />
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

type Danger = "logout" | "suspend" | "delete" | "reset" | null;

function SecurityMenu({ member, isSelf }: { member: MemberDetail; isSelf: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [danger, setDanger] = useState<Danger>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const done = { onDone: () => setDanger(null) };
  const logout = useMemberAction(member.id, (reason: string) => revokeSessions(member.id, reason), {
    success: (n) => (n ? `Signed out of ${n} device${n === 1 ? "" : "s"}` : "No active sessions to sign out"),
    error: "Could not sign the member out",
    ...done,
  });
  const verify = useMemberAction(member.id, () => resendVerification(member.id), { success: (msg) => msg, error: "Could not send the code" });
  const status = useMemberAction(member.id, (v: { accountStatus: "ACTIVE" | "SUSPENDED"; reason?: string }) => updateUser(member.id, v), {
    success: (_d, v) => (v.accountStatus === "ACTIVE" ? "Account reactivated" : "Account suspended"),
    error: "Could not change the account status",
    ...done,
  });
  const reset = useMemberAction(member.id, () => sendPasswordReset(member.id), { success: (r) => `Reset email sent to ${r.email}`, error: "Could not send the reset email", ...done });
  const remove = useMemberAction(member.id, (reason: string) => deleteUser(member.id, reason), {
    success: `Deleted ${member.email}`,
    error: "Could not delete the member",
    onDone: () => navigate("/users"),
  });

  const item = (Icon: typeof LogOut, label: string, onClick: () => void, tone?: "danger") => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm", tone === "danger" ? "text-danger hover:bg-danger/10" : "text-foreground/85 hover:bg-gold/10")}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button variant="glass" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} disabled={isSelf} title={isSelf ? "Use another admin account to change your own access" : undefined}>
        <ShieldAlert className="h-4 w-4" /> Security <ChevronDown className="h-4 w-4" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60">
          {item(LogOut, "Sign out of all devices", () => setDanger("logout"))}
          {member.email && !member.isEmailVerified && item(Mail, verify.isPending ? "Sending code…" : "Resend verification email", () => verify.mutate())}
          {member.signInMethod === "PASSWORD" && item(KeyRound, "Send password reset", () => setDanger("reset"))}
          {member.accountStatus === "ACTIVE"
            ? item(ShieldAlert, "Suspend account", () => setDanger("suspend"), "danger")
            : item(ShieldCheck, "Reactivate account", () => status.mutate({ accountStatus: "ACTIVE" }))}
          <div className="my-1 border-t border-border" />
          {item(Trash2, "Delete member", () => setDanger("delete"), "danger")}
        </div>
      )}

      <ReasonDialog
        open={danger === "logout"}
        title="Sign out of every device?"
        message="They'll need to log in again on each phone or browser."
        confirmLabel="Sign out everywhere"
        pending={logout.isPending}
        onConfirm={(reason) => logout.mutate(reason)}
        onCancel={() => setDanger(null)}
      />
      <ReasonDialog
        open={danger === "suspend"}
        title="Suspend this account?"
        message="They'll be signed out and can't log in or check in until you reactivate the account."
        confirmLabel="Suspend"
        pending={status.isPending}
        onConfirm={(reason) => status.mutate({ accountStatus: "SUSPENDED", reason })}
        onCancel={() => setDanger(null)}
      />
      <ReasonDialog
        open={danger === "delete"}
        title="Delete this member?"
        message={`${member.email} will be removed and signed out everywhere. This can't be undone from the admin panel.`}
        confirmLabel="Delete member"
        pending={remove.isPending}
        onConfirm={(reason) => remove.mutate(reason)}
        onCancel={() => setDanger(null)}
      />
      <ConfirmDialog
        open={danger === "reset"}
        title="Send a password reset email?"
        message={`${member.email} gets a code to choose a new password and is signed out everywhere. You never see or set their password.`}
        confirmLabel="Send reset email"
        pending={reset.isPending}
        onCancel={() => setDanger(null)}
        onConfirm={() => reset.mutate()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MemberHeader({ member, isSelf, onAssignPlan, onPrintCard }: { member: MemberDetail; isSelf: boolean; onAssignPlan: () => void; onPrintCard: () => void }) {
  const [editing, setEditing] = useState(false);
  const checkIn = useMemberAction(member.id, () => manualCheckIn(member.id), { success: "Checked in — visit logged", error: "Could not check in" });
  const membershipLabel = member.membership
    ? { ACTIVE: "Active member", FROZEN: "Membership frozen", EXPIRED: "Membership expired", CANCELLED: "Membership cancelled" }[member.membership.status]
    : "No membership";

  return (
    <header className="glass-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <Avatar name={member.name} email={member.email} photoUrl={member.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold uppercase">{displayName(member)}</h1>
              <button type="button" onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted hover:bg-gold/10 hover:text-gold" aria-label="Edit member details">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {member.email && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 hover:text-gold">
                  <Mail className="h-3.5 w-3.5" /> {member.email}
                </a>
              )}
              {member.phone ? (
                <>
                  <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 hover:text-gold" title={member.isPhoneVerified ? "Verified by OTP" : "Not verified yet"}>
                    <Phone className="h-3.5 w-3.5" /> {member.phone}
                    {member.isPhoneVerified && <BadgeCheck className="h-3.5 w-3.5 text-success" aria-label="verified" />}
                  </a>
                  <a href={whatsAppLink(member.phone, `Hi ${firstName(member)}, `)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-success hover:underline">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </>
              ) : null}
              {member.alternatePhone && (
                <a href={`tel:${member.alternatePhone}`} className="flex items-center gap-1.5 hover:text-gold">
                  <Phone className="h-3.5 w-3.5" /> Alt: {member.alternatePhone}
                </a>
              )}
              {!member.phone && (
                <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[#fab219] hover:underline">
                  <Phone className="h-3.5 w-3.5" /> Add phone number
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoleBadge role={member.role} />
              <StatusBadge status={member.accountStatus} />
              {member.email && (
                <Pill tone={member.isEmailVerified ? "success" : "warning"}>
                  {member.isEmailVerified ? <BadgeCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {member.isEmailVerified ? "Email verified" : "Email not verified"}
                </Pill>
              )}
              <Pill tone={member.membership?.status === "ACTIVE" ? "gold" : "muted"}>{membershipLabel}</Pill>
            </div>
            <div className="mt-3">
              <TagsEditor member={member} />
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>Joined {fmtDate.format(new Date(member.createdAt))}</span>
              {member.lastVisitAt && <span>Last visit {fmtDate.format(new Date(member.lastVisitAt))}</span>}
              {member.emergencyContactName && (
                <span>
                  Emergency: {member.emergencyContactName}
                  {member.emergencyContactRelation && ` (${member.emergencyContactRelation})`}
                  {member.emergencyContactPhone && (
                    <>
                      {" · "}
                      <a href={`tel:${member.emergencyContactPhone}`} className="hover:text-gold">
                        {member.emergencyContactPhone}
                      </a>
                    </>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
          <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
            {checkIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Check in
          </Button>
          <Button variant="glass" onClick={onPrintCard}>
            <IdCard className="h-4 w-4" /> Member card
          </Button>
          <Button variant="glass" onClick={onAssignPlan}>
            <ClipboardList className="h-4 w-4" /> Assign plan
          </Button>
          <SecurityMenu member={member} isSelf={isSelf} />
        </div>
      </div>
      {member.membership?.status === "FROZEN" && member.membership.resumeAt && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted">
          <CalendarClock className="h-4 w-4 text-gold" /> Frozen until {fmtDate.format(new Date(member.membership.resumeAt))} — check-ins are paused.
        </p>
      )}
      <EditProfileDialog member={member} open={editing} onClose={() => setEditing(false)} />
    </header>
  );
}
