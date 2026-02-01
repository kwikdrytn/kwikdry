import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { OfflineBanner } from "@/components/OfflineBanner";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Checklists from "./pages/Checklists";
import Equipment from "./pages/Equipment";
import Calls from "./pages/Calls";
import JobMap from "./pages/JobMap";
import UserManagement from "./pages/admin/UserManagement";
import InventoryManagement from "./pages/admin/InventoryManagement";
import InventoryDetail from "./pages/admin/InventoryDetail";
import ChecklistReview from "./pages/admin/ChecklistReview";
import ChecklistSubmissionDetail from "./pages/admin/ChecklistSubmissionDetail";
import WeeklyChecklist from "./pages/technician/WeeklyChecklist";
import LocationManagement from "./pages/admin/LocationManagement";
import Settings from "./pages/Settings";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <OfflineBanner />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* All roles can access Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Inventory Management */}
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <InventoryManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <InventoryDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Legacy inventory route redirect */}
            <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
            
            {/* Admin and Technician routes */}
            <Route
              path="/checklists"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <Checklists />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/technician/checklist/weekly"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <WeeklyChecklist />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Admin Checklist Review */}
            <Route
              path="/admin/checklists"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <ChecklistReview />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/checklists/:submissionId"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <ChecklistSubmissionDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Admin only routes */}
            <Route
              path="/equipment"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <Equipment />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <UserManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/locations"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <LocationManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <Settings />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Admin and Call Staff routes */}
            <Route
              path="/calls"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'call_staff']}>
                    <Calls />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/job-map"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'call_staff']}>
                    <JobMap />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Legacy route redirect */}
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
