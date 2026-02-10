import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OAuthCallbackHandler } from "@/components/OAuthCallbackHandler";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Checklists from "./pages/Checklists";
import Equipment from "./pages/Equipment";
import EquipmentDetail from "./pages/admin/EquipmentDetail";
import JobMap from "./pages/JobMap";
import UserManagement from "./pages/admin/UserManagement";
import InventoryManagement from "./pages/admin/InventoryManagement";
import InventoryDetail from "./pages/admin/InventoryDetail";
import ChecklistSubmissionDetail from "./pages/admin/ChecklistSubmissionDetail";
import LocationManagement from "./pages/admin/LocationManagement";
import IntegrationSettings from "./pages/admin/IntegrationSettings";

import CallLog from "./pages/admin/CallLog";
import CallMetrics from "./pages/admin/CallMetrics";
import Training from "./pages/Training";
import TrainingVideo from "./pages/TrainingVideo";
import TrainingManagement from "./pages/admin/TrainingManagement";
import PayrollReports from "./pages/admin/PayrollReports";
import Settings from "./pages/Settings";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <OfflineBanner />
        <OAuthCallbackHandler />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Dashboard - All authenticated users */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Inventory - Users with inventory.view permission */}
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="inventory.view">
                    <InventoryManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="inventory.view">
                    <InventoryDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Checklists - Role-based tabs within page */}
            <Route
              path="/checklists"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="checklists.submit">
                    <Checklists />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checklists/:submissionId"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="checklists.view_submissions">
                    <ChecklistSubmissionDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirects */}
            <Route path="/admin/checklists" element={<Navigate to="/checklists" replace />} />
            <Route path="/admin/checklists/:submissionId" element={<Navigate to="/checklists/:submissionId" replace />} />
            
            {/* Equipment - Users with equipment.view permission */}
            <Route
              path="/equipment"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="equipment.view">
                    <Equipment />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="equipment.view">
                    <EquipmentDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Calls - Users with calls.view permission */}
            <Route
              path="/calls"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="calls.view">
                    <CallLog />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calls/metrics"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="calls.view_metrics">
                    <CallMetrics />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirects */}
            <Route path="/admin/calls" element={<Navigate to="/calls" replace />} />
            <Route path="/admin/calls/metrics" element={<Navigate to="/calls/metrics" replace />} />
            
            {/* Job Map - Users with job_map.view permission */}
            <Route
              path="/job-map"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="job_map.view">
                    <JobMap />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Training - Users with training.view permission */}
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="training.view">
                    <Training />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training/video/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="training.view">
                    <TrainingVideo />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* Training Management - Users with training.manage permission */}
            <Route
              path="/admin/training"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="training.manage">
                    <TrainingManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* Payroll Reports - Users with payroll.view permission */}
            <Route
              path="/payroll"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="payroll.view">
                    <PayrollReports />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="users.manage">
                    <UserManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirect */}
            <Route path="/admin/users" element={<Navigate to="/users" replace />} />
            
            {/* Locations - Users with locations.manage permission */}
            <Route
              path="/locations"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="locations.manage">
                    <LocationManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            
            {/* Settings - All roles can view their profile */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="settings.view">
                    <Settings />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/integrations"
              element={
                <ProtectedRoute>
                  <RoleGuard requiredPermission="settings.manage_integrations">
                    <IntegrationSettings />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirect */}
            <Route path="/admin/settings/integrations" element={<Navigate to="/settings/integrations" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
