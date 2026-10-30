import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  NotebookPen,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  addNote,
  deleteNote,
  getTimeline,
  listNotes,
  revealMedical,
  updateMedical,
  updateNote,
  type MedicalDetails,
  type MemberDetail,
  type TimelineItem,
} from "@/lib/member-api";
import { fmtDate, fmtDateTime, istDateInput, textareaClass } from "@/lib/member-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/components/ui/form-message";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { Empty, Panel, Pill } from "@/components/member/shared";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const KIND: Record<TimelineItem["kind"], { icon: typeof Activity; tone: string }> = {
  CHECK_IN: { icon: CalendarCheck, tone: "text-success bg-success/10" },
  WORKOUT: { icon: Dumbbell, tone: "text-gold bg-gold/10" },
  PAYMENT: { icon: CreditCard, tone: "text-gold bg-gold/10" },
  PLAN: { icon: ClipboardList, tone: "text-foreground bg-surface-2" },
  PT: { icon: UserCog, tone: "text-gold bg-gold/10" },
  ADMIN: { icon: ShieldCheck, tone: "text-muted bg-surface-2" },
};

export function TimelineCard({ member }: { member: MemberDetail }) {
  const timeline = useInfiniteQuery({
    queryKey: ["member-timeline", member.id],
    queryFn: ({ pageParam }) => getTimeline(member.id, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });
  const items = timeline.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Panel title="Activity timeline" icon={Activity}>
      {timeline.isPending && <Skeleton className="h-64 rounded-xl" />}
      {timeline.data && items.length === 0 && <Empty>Nothing yet — check-ins, workouts, payments and staff actions will show up here.</Empty>}
      {items.length > 0 && (
        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
          {items.map((item) => {
            const { icon: Icon, tone } = KIND[item.kind];
            return (
              <li key={item.id} className="relative flex gap-3">
                <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted">
                    {fmtDateTime.format(new Date(item.at))}
                    {item.detail && ` · ${item.detail}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {timeline.hasNextPage && (
        <Button variant="glass" size="sm" className="mt-4" disabled={timeline.isFetchingNextPage} onClick={() => timeline.fetchNextPage()}>
          {timeline.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Load older activity
        </Button>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Staff notes
// ---------------------------------------------------------------------------

export function NotesCard({ member }: { member: MemberDetail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["member-notes", member.id];
  const notes = useQuery({ queryKey: key, queryFn: () => listNotes(member.id) });
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = istDateInput(0);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: key });
      if (ok) toast.show(ok);
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not save the note"), "error");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setError(null);
    if (!body.trim()) return setError("Write the note first");
    void run(async () => {
      await addNote(member.id, body.trim(), followUp ? new Date(`${followUp}T09:00:00+05:30`).toISOString() : null);
      setBody("");
      setFollowUp("");
    }, "Note added");
  };

  const open = notes.data?.filter((n) => !n.isDone) ?? [];
  const done = notes.data?.filter((n) => n.isDone) ?? [];

  return (
    <Panel title="Staff notes" icon={NotebookPen} action={<Pill>Admins only</Pill>}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="note-body" className="sr-only">
          New note
        </label>
        <textarea id="note-body" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Asked about couple plan — call back after salary day." className={textareaClass} />
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="note-follow" className="mb-1 flex items-center gap-1 text-xs text-muted">
              <BellRing className="h-3 w-3" /> Follow up on (optional)
            </label>
            <Input id="note-follow" type="date" min={istDateInput(1)} value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-9 w-44" />
          </div>
          <Button type="submit" size="sm" className="ml-auto h-9" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add note
          </Button>
        </div>
        <FormAlert message={error} />
      </form>

      <ul className="mt-4 flex flex-col gap-2">
        {[...open, ...done].map((n) => {
          const due = n.followUpDate && !n.isDone ? n.followUpDate.slice(0, 10) <= today : false;
          return (
            <li key={n.id} className={cn("rounded-xl border p-3", n.isDone ? "border-border opacity-60" : due ? "border-warning/50 bg-warning/5" : "border-border bg-surface-2/50")}>
              <p className={cn("whitespace-pre-wrap text-sm", n.isDone && "line-through")}>{n.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  {n.author.name ?? n.author.email} · {fmtDate.format(new Date(n.createdAt))}
                </span>
                {n.followUpDate && (
                  <Pill tone={n.isDone ? "muted" : due ? "warning" : "gold"}>
                    <BellRing className="h-3 w-3" /> {due ? "Follow up due" : "Follow up"} {fmtDate.format(new Date(n.followUpDate))}
                  </Pill>
                )}
                <span className="ml-auto flex gap-1">
                  <button type="button" disabled={busy} onClick={() => run(() => updateNote(member.id, n.id, { isDone: !n.isDone }))} className="rounded p-1 hover:text-success" aria-label={n.isDone ? "Mark not done" : "Mark done"}>
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={busy} onClick={() => run(() => deleteNote(member.id, n.id), "Note deleted")} className="rounded p-1 hover:text-danger" aria-label="Delete note">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {notes.data?.length === 0 && <p className="mt-3 text-sm text-muted">No notes yet.</p>}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Medical details — hidden until someone asks, and every look is logged
// ---------------------------------------------------------------------------

const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function MedicalCard({ member }: { member: MemberDetail }) {
  const toast = useToast();
  const [data, setData] = useState<MedicalDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ conditions: "", injuries: "", allergies: "", notes: "" });

  const reveal = async () => {
    setBusy(true);
    try {
      setData(await revealMedical(member.id));
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not load medical details"), "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateMedical(member.id, {
        medicalConditions: splitList(form.conditions),
        injuries: splitList(form.injuries),
        allergies: splitList(form.allergies),
        medicalNotes: form.notes.trim() || null,
      });
      setData(await revealMedical(member.id));
      setEditing(false);
      toast.show("Medical details saved");
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not save"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Health & medical"
      icon={HeartPulse}
      action={
        data && (
          <button type="button" onClick={() => (setData(null), setEditing(false))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
            <EyeOff className="h-3.5 w-3.5" /> Hide
          </button>
        )
      }
    >
      {!data ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <ShieldCheck className="h-8 w-8 text-gold/60" />
          <p className="mt-2 text-sm">Blood group, conditions, injuries, allergies and clearance notes are private.</p>
          <p className="mt-1 text-xs text-muted">Viewing them is recorded with your name and the time.</p>
          <Button variant="glass" size="sm" className="mt-4" disabled={busy} onClick={reveal}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Show medical details
          </Button>
        </div>
      ) : editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {(
            [
              ["conditions", "Medical conditions", "e.g. Asthma, Diabetes"],
              ["injuries", "Injuries / health issues", "e.g. ACL repair (2023), Lower back pain"],
              ["allergies", "Allergies", "e.g. Peanuts"],
            ] as const
          ).map(([key, label, ph]) => (
            <div key={key}>
              <label htmlFor={`med-${key}`} className="mb-1 block text-xs font-medium text-muted">
                {label} <span className="font-normal">(comma separated)</span>
              </label>
              <Input id={`med-${key}`} value={form[key]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label htmlFor="med-notes" className="mb-1 block text-xs font-medium text-muted">
              Clearance notes
            </label>
            <textarea id="med-notes" rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={textareaClass} placeholder="e.g. Doctor cleared for moderate cardio, no heavy squats until March." />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="glass" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Blood group</p>
            <p className="mt-0.5 font-semibold">{data.bloodGroup ?? "Not recorded"}</p>
          </div>
          {[
            ["Medical conditions", data.medicalConditions],
            ["Injuries / health issues", data.injuries],
            ["Allergies", data.allergies],
          ].map(([label, list]) => (
            <div key={label as string}>
              <p className="text-xs text-muted">{label as string}</p>
              {(list as string[]).length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(list as string[]).map((x) => (
                    <Pill key={x} tone="warning">
                      {x}
                    </Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5">None recorded</p>
              )}
            </div>
          ))}
          <div>
            <p className="text-xs text-muted">Clearance notes</p>
            <p className="mt-0.5 whitespace-pre-wrap">{data.medicalNotes ?? "None"}</p>
          </div>
          <Button
            variant="glass"
            size="sm"
            className="self-start"
            onClick={() => {
              setForm({ conditions: data.medicalConditions.join(", "), injuries: data.injuries.join(", "), allergies: data.allergies.join(", "), notes: data.medicalNotes ?? "" });
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {data.viewLog.length > 0 && (
            <details className="border-t border-border pt-3 text-xs text-muted">
              <summary className="cursor-pointer hover:text-foreground">Viewed {data.viewLog.length === 10 ? "10+" : data.viewLog.length} time{data.viewLog.length === 1 ? "" : "s"} before</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {data.viewLog.map((v, i) => (
                  <li key={i}>
                    {v.by} · {fmtDateTime.format(new Date(v.at))}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}
