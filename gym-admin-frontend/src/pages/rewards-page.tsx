import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Coins, Gift, Loader2, Pencil, Plus, Search, Ticket, Trash2, XCircle } from "lucide-react";
import {
  cancelRedemptionAdmin,
  createRewardItem,
  deleteRewardItem,
  fulfillRedemption,
  listRedemptions,
  listRewardItems,
  updateRewardItem,
  type AdminRedemption,
  type AdminRewardItem,
  type RedemptionStatus,
  type RewardItemInput,
} from "@/lib/rewards-api";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/page";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUpload } from "@/components/image-upload";
import { Avatar } from "@/components/user-badges";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("en-IN");
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const STATUS_TABS: { key: RedemptionStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "To hand over" },
  { key: "FULFILLED", label: "Given" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];

const STATUS_PILL: Record<RedemptionStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-gold/15 text-gold" },
  FULFILLED: { label: "Given", className: "bg-success/10 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-foreground/10 text-muted" },
};

export function RewardsPage() {
  const [editing, setEditing] = useState<AdminRewardItem | "new" | null>(null);
  return (
    <div>
      <PageHeader
        eyebrow="Gamification"
        title="Rewards store"
        description="Members spend the coins they win on the leaderboard and from missions. Hand rewards over at the front desk by their code."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add reward
          </Button>
        }
      />
      <RedemptionQueue />
      <ItemsSection onEdit={setEditing} />
      <ItemDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// --- Front desk queue ---

function RedemptionQueue() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RedemptionStatus | "ALL">("PENDING");
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<AdminRedemption | null>(null);
  const debouncedCode = useDebouncedValue(code.trim());

  const list = useQuery({
    queryKey: ["admin-redemptions", status, debouncedCode, page],
    queryFn: () => listRedemptions({ status: status === "ALL" || debouncedCode ? undefined : status, code: debouncedCode || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-redemptions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-reward-items"] });
  };

  const fulfill = useMutation({
    mutationFn: (r: AdminRedemption) => fulfillRedemption(r.id),
    onSuccess: (_d, r) => {
      toast.show(`${r.item.name} handed to ${displayName(r.user)}`);
      setCode("");
      refresh();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not mark as given"), "error"),
  });

  return (
    <Card className="mt-6 p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-gold" /> Front desk
          </CardTitle>
          <CardDescription className="mt-1">Type the member&apos;s code to find their reward, then mark it given.</CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="Redemption code"
              placeholder="Code, e.g. K7P2QX9M"
              value={code}
              onChange={(e) => (setCode(e.target.value.toUpperCase()), setPage(1))}
              className="h-10 w-full pl-10 font-mono tracking-widest sm:w-56"
            />
          </div>
          <div role="tablist" aria-label="Redemption status" className="inline-flex rounded-xl border border-border bg-surface p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={status === t.key}
                onClick={() => (setStatus(t.key), setPage(1))}
                className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", status === t.key ? "bg-gold font-medium text-accent-foreground" : "text-muted hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {list.isPending && (
        <div className="flex flex-col gap-2 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}
      {list.isError && <p className="p-6 text-sm text-danger">{apiErrorMessage(list.error, "Could not load redemptions.")}</p>}
      {list.data?.items.length === 0 && (
        <p className="px-6 py-12 text-center text-sm text-muted">{debouncedCode ? `No redemption matches “${debouncedCode}”.` : "Nothing here right now."}</p>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className={cn("divide-y divide-border transition-opacity", list.isPlaceholderData && "opacity-60")}>
          {list.data.items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={r.user.name} email={r.user.email} photoUrl={r.user.photoUrl} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {displayName(r.user)} <span className="text-muted">· {r.item.name}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.user.phone ?? r.user.email} · {when.format(new Date(r.createdAt))} · {num.format(r.coins)} coins
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold tracking-[0.2em] text-gold">{r.code}</span>
              <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs", STATUS_PILL[r.status].className)}>{STATUS_PILL[r.status].label}</span>
              {r.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={fulfill.isPending} onClick={() => fulfill.mutate(r)}>
                    <CheckCircle2 className="h-4 w-4" /> Mark given
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(r)}>
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.data && (
        <div className="px-5 pb-4">
          <Pagination page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} total={list.data.pagination.total} onPageChange={setPage} />
        </div>
      )}
      <CancelDialog redemption={cancelling} onClose={() => setCancelling(null)} onDone={refresh} />
    </Card>
  );
}

function CancelDialog({ redemption, onClose, onDone }: { redemption: AdminRedemption | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [redemption]);
  const cancel = useMutation({
    mutationFn: () => cancelRedemptionAdmin(redemption!.id, note.trim() || undefined),
    onSuccess: () => {
      toast.show(`Cancelled — ${num.format(redemption!.coins)} coins refunded`);
      onDone();
      onClose();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not cancel"), "error"),
  });
  return (
    <Dialog
      open={Boolean(redemption)}
      onClose={cancel.isPending ? () => {} : onClose}
      title="Cancel this redemption?"
      description={redemption ? `${displayName(redemption.user)} gets ${num.format(redemption.coins)} coins back and the item returns to stock.` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cancel.isPending}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Cancel & refund
          </Button>
        </>
      }
    >
      <label className="block text-sm">
        Note for the member (optional)
        <Input data-autofocus className="mt-1.5" maxLength={200} placeholder="e.g. Out of this flavour — pick another" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Dialog>
  );
}

// --- Catalogue ---

function ItemsSection({ onEdit }: { onEdit: (item: AdminRewardItem) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ["admin-reward-items"], queryFn: listRewardItems });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-reward-items"] });

  const toggle = useMutation({
    mutationFn: (item: AdminRewardItem) => updateRewardItem(item.id, { isActive: !item.isActive }),
    onSuccess: (item) => {
      toast.show(item.isActive ? `${item.name} is live in the store` : `${item.name} is hidden from the store`);
      refresh();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not update"), "error"),
  });
  const remove = useMutation({
    mutationFn: (item: AdminRewardItem) => deleteRewardItem(item.id),
    onSuccess: (res, item) => {
      toast.show(res.archived ? `${item.name} archived (it has redemptions)` : `${item.name} deleted`);
      refresh();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not delete"), "error"),
  });

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
        <Gift className="h-5 w-5 text-gold" /> Rewards
      </h2>
      {items.isPending && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}
      {items.data?.length === 0 && (
        <div className="mt-4">
          <EmptyState title="No rewards yet" description="Add perks like a protein shake, a guest pass or a PT session. Members see them straight away." />
        </div>
      )}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.data?.map((item) => (
          <li key={item.id} className={cn("glass-card flex flex-col overflow-hidden", !item.isActive && "opacity-60")}>
            <div className="flex h-32 items-center justify-center bg-linear-to-br from-gold/15 to-surface-2">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift className="h-10 w-10 text-gold/50" />}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{item.name}</p>
                <span className="flex shrink-0 items-center gap-1 font-semibold text-gold">
                  <Coins className="h-4 w-4" /> {num.format(item.costCoins)}
                </span>
              </div>
              <p className="text-xs text-muted">
                {item.stock === null ? "Unlimited stock" : `${item.stock} in stock`}
                {item.maxPerMember !== null && ` · max ${item.maxPerMember} per member`}
                {" · "}
                {item.pending} pending · {item.fulfilled} given
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={item.isActive} onChange={() => toggle.mutate(item)} className="accent-[var(--gold)]" />
                  Live in store
                </label>
                <Button size="sm" variant="glass" className="h-8 w-8 p-0" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-danger"
                  aria-label={item.pending + item.fulfilled > 0 ? `Archive ${item.name}` : `Delete ${item.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item)}
                >
                  {item.pending + item.fulfilled > 0 ? <Archive className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const EMPTY: RewardItemInput = { name: "", description: "", imageUrl: null, costCoins: 100, stock: null, maxPerMember: null, isActive: true, sortOrder: 0 };

function ItemDialog({ item, onClose }: { item: AdminRewardItem | "new" | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RewardItemInput>(EMPTY);
  useEffect(() => {
    if (item === "new") setForm(EMPTY);
    else if (item) setForm({ ...item });
  }, [item]);
  const set = <K extends keyof RewardItemInput>(key: K, value: RewardItemInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const optionalInt = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v)) || 0));
  const valid = form.name.trim().length >= 2 && form.costCoins >= 1;

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, name: form.name.trim(), description: form.description?.trim() || null };
      return item === "new" ? createRewardItem(body) : updateRewardItem((item as AdminRewardItem).id, body);
    },
    onSuccess: (saved) => {
      toast.show(item === "new" ? `${saved.name} added to the store` : `${saved.name} saved`);
      queryClient.invalidateQueries({ queryKey: ["admin-reward-items"] });
      onClose();
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not save the reward"), "error"),
  });

  return (
    <Dialog
      open={Boolean(item)}
      onClose={save.isPending ? () => {} : onClose}
      title={item === "new" ? "Add a reward" : "Edit reward"}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <label className="block text-sm sm:col-span-2">
          Name
          <Input data-autofocus className="mt-1.5" maxLength={80} placeholder="e.g. Protein shake" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Description
          <Input className="mt-1.5" maxLength={400} placeholder="What they get, and any conditions" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="text-sm sm:col-span-2">
          Image
          <div className="mt-1.5">
            <ImageUpload value={form.imageUrl ?? undefined} onChange={(url) => set("imageUrl", url)} />
          </div>
        </div>
        <label className="block text-sm">
          Price (coins)
          <Input type="number" min={1} className="mt-1.5" value={form.costCoins} onChange={(e) => set("costCoins", Math.max(1, Math.round(Number(e.target.value)) || 1))} />
        </label>
        <label className="block text-sm">
          Stock <span className="text-muted">(blank = unlimited)</span>
          <Input type="number" min={0} className="mt-1.5" value={form.stock ?? ""} onChange={(e) => set("stock", optionalInt(e.target.value))} />
        </label>
        <label className="block text-sm">
          Max per member <span className="text-muted">(blank = no limit)</span>
          <Input type="number" min={1} className="mt-1.5" value={form.maxPerMember ?? ""} onChange={(e) => set("maxPerMember", optionalInt(e.target.value) || null)} />
        </label>
        <label className="block text-sm">
          Order <span className="text-muted">(lower shows first)</span>
          <Input type="number" min={0} className="mt-1.5" value={form.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, Math.round(Number(e.target.value)) || 0))} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-[var(--gold)]" />
          Show in the store
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
