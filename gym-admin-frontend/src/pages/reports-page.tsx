import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { downloadReport, type ReportFormat, type ReportType } from "@/lib/ops-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const REPORTS: { type: ReportType; label: string; description: string; needsDateRange: boolean }[] = [
  { type: "revenue", label: "Revenue", description: "All payments and invoices.", needsDateRange: true },
  { type: "attendance", label: "Attendance", description: "Gym check-in/check-out log.", needsDateRange: true },
  { type: "membership", label: "Membership", description: "All memberships and their status.", needsDateRange: false },
  { type: "users", label: "Users", description: "User accounts and roles.", needsDateRange: true },
  { type: "workout", label: "Workout Completions", description: "Logged workout sessions.", needsDateRange: true },
  { type: "diet", label: "Diet Plans", description: "Diet plan ownership and assignments.", needsDateRange: false },
];

const FORMATS: ReportFormat[] = ["csv", "xlsx", "pdf"];

function ReportCard({
  type,
  label,
  description,
  needsDateRange,
}: {
  type: ReportType;
  label: string;
  description: string;
  needsDateRange: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const mutation = useMutation({
    mutationFn: (format: ReportFormat) => downloadReport(type, format, from || undefined, to || undefined),
  });

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{label}</CardTitle>
      <CardDescription>{description}</CardDescription>
      {needsDateRange && (
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm" />
        </div>
      )}
      <div className="flex gap-2">
        {FORMATS.map((format) => (
          <Button
            key={format}
            variant="glass"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(format)}
          >
            <Download className="h-3.5 w-3.5" /> {format.toUpperCase()}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-muted">Export platform data as CSV, Excel, or PDF.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <ReportCard key={r.type} {...r} />
        ))}
      </div>
    </div>
  );
}
