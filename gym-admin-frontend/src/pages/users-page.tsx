import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Search, Trash2 } from "lucide-react";
import {
  type AccountStatus,
  type AdminUserListItem,
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

const STATUS_STYLES: Record<AccountStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  SUSPENDED: "bg-[#fab219]/10 text-[#fab219]",
  BANNED: "bg-danger/10 text-danger",
};

type PendingAction = { kind: "reset" | "delete" | "suspend"; user: AdminUserListItem };

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const [searchParams] = useSearchParams();
  // Other pages deep-link here with ?search=<email>.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["admin-users", debouncedSearch, page],
    queryFn: () => listUsers({ search: debouncedSearch || undefined, page }),
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

      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load users. Check that the backend is running, then refresh.
        </p>
      )}
      {isPending && <SkeletonList rows={5} className="mt-6" />}
      {data && data.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title={debouncedSearch ? `No users match “${debouncedSearch}”` : "No users yet"} />
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-gold">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {u.name ?? u.email}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                      </div>
                      <div className="truncate text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold">{u.role}</span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS_STYLES[u.accountStatus])}>{u.accountStatus}</span>
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
