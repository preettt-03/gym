"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";
import { CheckCircle2, Clock, QrCode } from "lucide-react";
import { format } from "date-fns";
import { checkIn, checkOut, getStatus, listMyAttendance } from "@/lib/attendance-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function AttendanceContent() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({ queryKey: ["attendance-status"], queryFn: getStatus });
  const { data: history } = useQuery({ queryKey: ["attendance-history"], queryFn: listMyAttendance });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidate });
  const checkOutMutation = useMutation({ mutationFn: checkOut, onSuccess: invalidate });

  const error = checkInMutation.error ?? checkOutMutation.error;
  const errorMessage = isAxiosError(error) ? error.response?.data?.error?.message : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Gym Attendance
      </motion.h1>
      <p className="mt-1 text-muted">Check in when you arrive, check out when you leave.</p>

      <Card className="mt-8 flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full accent-gradient text-accent-foreground">
          <QrCode className="h-9 w-9" />
        </div>

        {status?.checkedIn ? (
          <>
            <div>
              <div className="text-lg font-medium">Checked in</div>
              <div className="text-sm text-muted">
                Since {status.attendance && format(new Date(status.attendance.checkInAt), "p")}
              </div>
            </div>
            <Button disabled={checkOutMutation.isPending} onClick={() => checkOutMutation.mutate()}>
              {checkOutMutation.isPending ? "Checking out..." : "Check out"}
            </Button>
          </>
        ) : (
          <>
            <div className="text-lg font-medium">Not checked in</div>
            <Button disabled={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
              {checkInMutation.isPending ? "Checking in..." : "Check in"}
            </Button>
          </>
        )}

        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
      </Card>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wide text-muted">History</h2>
      <div className="flex flex-col gap-2">
        {history?.length === 0 && (
          <Card>
            <CardDescription>No attendance recorded yet.</CardDescription>
          </Card>
        )}
        {history?.map((a) => (
          <Card key={a.id} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-accent" />
              <div>
                <div className="text-sm font-medium">{format(new Date(a.checkInAt), "PPP")}</div>
                <div className="text-xs text-muted">
                  {format(new Date(a.checkInAt), "p")} –{" "}
                  {a.checkOutAt ? format(new Date(a.checkOutAt), "p") : "ongoing"}
                </div>
              </div>
            </div>
            {a.durationMinutes !== null && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent-2" /> {a.durationMinutes} min
              </span>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <RequireAuth>
      <AttendanceContent />
    </RequireAuth>
  );
}
