import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/login-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { UsersPage } from "@/pages/users-page";
import { UserDetailPage } from "@/pages/user-detail-page";
import { ExercisesPage } from "@/pages/exercises-page";
import { FoodsPage } from "@/pages/foods-page";
import { CategoriesPage } from "@/pages/categories-page";
import { ToolsPage } from "@/pages/tools-page";
import { ChatPage } from "@/pages/chat-page";
import { NotificationsPage } from "@/pages/notifications-page";
import { MembershipPlansPage } from "@/pages/membership-plans-page";
import { AttendancePage } from "@/pages/attendance-page";
import { MissionsPage } from "@/pages/missions-page";
import { WorkoutPlansPage } from "@/pages/workout-plans-page";
import { DietPlansPage } from "@/pages/diet-plans-page";
import { CmsPage } from "@/pages/cms-page";
import { AuditLogsPage } from "@/pages/audit-logs-page";
import { ReportsPage } from "@/pages/reports-page";
import { SegmentsPage } from "@/pages/segments-page";
import { AiManagementPage } from "@/pages/ai-management-page";
import { RequireAdmin } from "@/components/require-admin";
import { AdminLayout } from "@/components/admin-layout";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/workout-plans" element={<WorkoutPlansPage />} />
        <Route path="/diet-plans" element={<DietPlansPage />} />
        <Route path="/membership-plans" element={<MembershipPlansPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/missions" element={<MissionsPage />} />
        <Route path="/cms" element={<CmsPage />} />
        <Route path="/segments" element={<SegmentsPage />} />
        <Route path="/ai-management" element={<AiManagementPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
