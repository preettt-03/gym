import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/ops-api";
import { Card, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AuditLogsPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const { data } = useQuery({
    queryKey: ["audit-logs", entityType, action],
    queryFn: () => listAuditLogs({ entityType: entityType || undefined, action: action || undefined }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <p className="mt-1 text-muted">{data?.pagination.total ?? 0} recorded admin actions.</p>

      <div className="mt-6 flex gap-3">
        <Input placeholder="Filter by entity type (e.g. users)" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <Input placeholder="Filter by action/path" value={action} onChange={(e) => setAction(e.target.value)} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {data?.items.length === 0 && (
          <Card>
            <CardDescription>No matching audit log entries.</CardDescription>
          </Card>
        )}
        {data?.items.map((log) => (
          <Card key={log.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="text-sm font-medium">{log.action}</div>
              <div className="text-xs text-muted">
                {log.admin.name ?? log.admin.email} · {new Date(log.createdAt).toLocaleString()}
                {log.ipAddress && ` · ${log.ipAddress}`}
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                log.statusCode < 300
                  ? "bg-accent-2/15 text-accent-2"
                  : log.statusCode < 500
                    ? "bg-yellow-500/15 text-yellow-500"
                    : "bg-danger/15 text-danger"
              )}
            >
              {log.statusCode}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
