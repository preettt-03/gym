import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, KeyRound, Search, Trash2, UserCog } from "lucide-react";
import {
  type AccountStatus,
  type AdminUserListItem,
  type Role,
  deleteUser,
  listUsers,
  sendPasswordReset,
  updateUser,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader, Pagination, EmptyState } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, RoleBadge, StatusBadge } from "@/components/user-badges";
import { ROLE_LABEL, STATUS_LABEL, displayName } from "@/lib/format";

const ROLES: Role[] = ["USER", "TRAINER", "ADMIN"];
const STATUSES: AccountStatus[] = ["ACTIVE", "SUSPENDED", "BANNED"];

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:border-gold/40 hover:text-foreground"
      )}
    >
      {label}
      {count !== undefined && <span className={cn("text-xs", active ? "text-accent-foreground/70" : "text-muted")}>{count}</span>}
    </button>
  );
}

type PendingAction = { kind: "reset" | "delete" | "suspend"; user: AdminUserListItem };

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const [searchParams] = useSearchParams();
  // Other pages deep-link here with ?search=<email>.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | undefined>(() => (searchParams.get("role") as Role | null) ?? undefined);
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["admin-users", debouncedSearch, role, status, page],
    queryFn: () => listUsers({ search: debouncedSearch || undefined, role, accountStatus: status, page }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const onError = (fallback: string) => (err: unknown) => {
    toast.show(apiErrorMessage(err, fallback), "error");
    setPending(null);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, accountStatus }: { id: string; accountStatus: AccountStatus }) => updateUser(id, { accountStatus }),
    onSuccess: (_d, v) => {
      refresh();
      toast.show(v.accountStatus === "ACTIVE" ? "Account reactivated" : "Account suspended");
      setPending(null);
    },
    onError: onError("Could not update the account"),
  });

  const resetMutation = useMutation({
    mutationFn: (u: AdminUserListItem) => sendPasswordReset(u.id),
    onSuccess: (res) => {
      toast.show(`Reset email sent to ${res.email}`);
      setPending(null);
    },
    onError: onError("Could not send the reset email"),
  });

  const deleteMutation = useMutation({
    mutationFn: (u: AdminUserListItem) => deleteUser(u.id),
    onSuccess: (_d, u) => {
      refresh();
      toast.show(`Deleted ${u.email}`);
      setPending(null);
    },
    onError: onError("Could not delete the user"),
  });

  const target = pending?.user;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Members" title="Users" description={`${data?.pagination.total ?? 0} accounts. Search by name or email.`} />

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search by name or email..."
          className="pl-11"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by role">
          <FilterChip active={!role} onClick={() => (setRole(undefined), setPage(1))} label="All roles" />
          {ROLES.map((r) => (
            <FilterChip
              key={r}
              active={role === r}
              onClick={() => (setRole(r), setPage(1))}
              label={`${ROLE_LABEL[r]}s`}
              count={data?.facets.role[r] ?? 0}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <FilterChip active={!status} onClick={() => (setStatus(undefined), setPage(1))} label="Any status" />
          {STATUSES.map((st) => (
            <FilterChip
              key={st}
              active={status === st}
              onClick={() => (setStatus(st), setPage(1))}
              label={STATUS_LABEL[st]}
              count={data?.facets.accountStatus[st] ?? 0}
            />
          ))}
        </div>
      </div>

      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load users. Check that the backend is running, then refresh.
        </p>
      )}
      {isPending && <SkeletonList rows={5} className="mt-6" />}
      {data && data.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title={debouncedSearch || role || status ? "No users match these filters" : "No users yet"} />
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className={cn("mt-6 transition-opacity", isPlaceholderData && "opacity-60")}>
          <ul className="flex flex-col gap-2">
            {data.items.map((u: AdminUserListItem) => {
              const isSelf = u.id === currentAdminId;
              return (
                <li key={u.id} className="glass-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.name} email={u.email} />
                    <div className="min-w-0">
                      <Link to={`/users/${u.id}`} className="block truncate font-medium hover:text-gold">
                        {displayName(u)}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                      </Link>
                      <div className="truncate text-xs text-muted">{[u.email, u.phone].filter(Boolean).join(" · ")}</div>
                      {u.trainer && <div className="truncate text-xs text-muted">Trainer: {u.trainer.name ?? u.trainer.email}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={u.role} />
                    <StatusBadge status={u.accountStatus} />
                    {/* Admins can't suspend, reset or delete their own account from here. */}
                    {!isSelf && (
                      <>
                        {u.accountStatus === "ACTIVE" ? (
                          <Button variant="glass" size="sm" onClick={() => setPending({ kind: "suspend", user: u })}>
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="glass"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: u.id, accountStatus: "ACTIVE" })}
                          >
                            Reactivate
                          </Button>
                        )}
                        <Button variant="glass" size="sm" onClick={() => setPending({ kind: "reset", user: u })}>
                          <KeyRound className="h-4 w-4" /> Reset password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-danger hover:bg-danger/10"
                          aria-label={`Delete ${u.email}`}
                          onClick={() => setPending({ kind: "delete", user: u })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Link
                      to={`/users/${u.id}`}
                      aria-label={`Manage ${u.email}`}
                      className="flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-sm text-muted hover:border-gold/40 hover:text-foreground"
                    >
                      <UserCog className="h-4 w-4" /> Manage <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={pending?.kind === "reset"}
        title="Send a password reset email?"
        message={
          <>
            <strong className="text-foreground">{target?.email}</strong> will get a code to choose a new password and will be signed out
            on every device. You won&apos;t see or set their password.
          </>
        }
        confirmLabel="Send reset email"
        pending={resetMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => target && resetMutation.mutate(target)}
      />
      <ConfirmDialog
        open={pending?.kind === "suspend"}
        title="Suspend this account?"
        message={
          <>
            <strong className="text-foreground">{target?.email}</strong> won&apos;t be able to log in until you reactivate the account.
          </>
        }
        confirmLabel="Suspend"
        destructive
        pending={statusMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => target && statusMutation.mutate({ id: target.id, accountStatus: "SUSPENDED" })}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        title="Delete this user?"
        message={
          <>
            <strong className="text-foreground">{target?.email}</strong> will be removed and signed out everywhere. This can&apos;t be
            undone from the admin panel.
          </>
        }
        confirmLabel="Delete user"
        destructive
        pending={deleteMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => target && deleteMutation.mutate(target)}
      />
    </div>
  );
}
