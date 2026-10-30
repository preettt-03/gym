-- CreateIndex
CREATE INDEX "attendances_checkInAt_idx" ON "attendances"("checkInAt");

-- CreateIndex
CREATE INDEX "workout_exercise_logs_completedAt_idx" ON "workout_exercise_logs"("completedAt");

-- CreateIndex
CREATE INDEX "workout_logs_completedAt_idx" ON "workout_logs"("completedAt");

