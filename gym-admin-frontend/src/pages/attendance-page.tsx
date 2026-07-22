import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { adminCheckIn, listAllAttendance, listUsers } from "@/lib/api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AttendancePage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["admin-attendance"], queryFn: listAllAttendance });

  const { data: candidates } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ search: search || undefined }),
    enabled: search.trim().length >= 2,
  });

  const checkInMutation = useMutation({
    mutationFn: adminCheckIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-attendance"] });
      setSearch("");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="mt-1 text-muted">{data?.pagination.total ?? 0} check-ins recorded.</p>

      <Card className="mt-6">
        <CardTitle>Front-desk check-in</CardTitle>
        <CardDescription className="mt-1 mb-4">
          Manual fallback for QR failures. Still validates membership server-side.
        </CardDescription>
        <div className="relative max-w-sm">
          <Input placeholder="Search user by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search.trim().length >= 2 && candidates && (
            <div className="glass-card absolute z-10 mt-1 w-full p-1">
              {candidates.items.map((u) => (
                <button
                  key={u.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5"
                  onClick={() => checkInMutation.mutate(u.id)}
                >
                  <span>{u.name ?? u.email}</span>
                  <UserCheck className="h-3.5 w-3.5 text-accent" />
                </button>
              ))}
              {candidates.items.length === 0 && <div className="px-3 py-2 text-sm text-muted">No matches.</div>}
            </div>
          )}
        </div>
        {checkInMutation.isError && (
          <p className="mt-2 text-sm text-danger">Check-in failed — user may not have an active membership.</p>
        )}
      </Card>

      <div className="mt-6 flex flex-col gap-2">
        {data?.items.map((a) => (
          <Card key={a.id} className="flex items-center justify-between py-4">
            <div>
              <div className="text-sm font-medium">{a.user.name ?? a.user.email}</div>
              <div className="text-xs text-muted">
                {new Date(a.checkInAt).toLocaleString()} · {a.method}
              </div>
            </div>
            <div className="text-xs text-muted">
              {a.checkOutAt ? `${a.durationMinutes} min` : "ongoing"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
