import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { type AccountStatus, type AdminUserListItem, deleteUser, listUsers, updateUser } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<AccountStatus, string> = {
  ACTIVE: "bg-accent-2/15 text-accent-2",
  SUSPENDED: "bg-yellow-500/15 text-yellow-500",
  BANNED: "bg-danger/15 text-danger",
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ search: search || undefined }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, accountStatus }: { id: string; accountStatus: AccountStatus }) =>
      updateUser(id, { accountStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-muted">{data?.pagination.total ?? 0} total users</p>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search by name or email..."
          className="pl-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <SkeletonList rows={5} className="mt-6" />}

      <div className="mt-6 flex flex-col gap-2">
        {data?.items.map((u: AdminUserListItem) => (
          <Card key={u.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <div className="font-medium">{u.name ?? u.email}</div>
              <div className="text-xs text-muted">{u.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">{u.role}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS_STYLES[u.accountStatus])}>
                {u.accountStatus}
              </span>
              {u.accountStatus === "ACTIVE" ? (
                <Button
                  variant="glass"
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: u.id, accountStatus: "SUSPENDED" })}
                >
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
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirm(`Delete ${u.email}?`)) deleteMutation.mutate(u.id);
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
