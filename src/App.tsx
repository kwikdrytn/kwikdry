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
import Dashboard from "./pages/Dashboard";
import Checklists from "./pages/Checklists";
import Equipment from "./pages/Equipment";
import JobMap from "./pages/JobMap";
import UserManagement from "./pages/admin/UserManagement";
import InventoryManagement from "./pages/admin/InventoryManagement";
import InventoryDetail from "./pages/admin/InventoryDetail";
import ChecklistSubmissionDetail from "./pages/admin/ChecklistSubmissionDetail";
import LocationManagement from "./pages/admin/LocationManagement";
import IntegrationSettings from "./pages/admin/IntegrationSettings";
import CallLog from "./pages/admin/CallLog";
import CallMetrics from "./pages/admin/CallMetrics";
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
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Dashboard - All roles */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Inventory - Admin and Technicians */}
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <InventoryManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'technician']}>
                    <InventoryDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirect */}
            <Route path="/admin/inventory" element={<Navigate to="/inventory" replace />} />
            <Route path="/admin/inventory/:id" element={<Navigate to="/inventory/:id" replace />} />
            
            {/* Checklists - Role-based tabs within page */}
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
              path="/checklists/:submissionId"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <ChecklistSubmissionDetail />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirects */}
            <Route path="/admin/checklists" element={<Navigate to="/checklists" replace />} />
            <Route path="/admin/checklists/:submissionId" element={<Navigate to="/checklists/:submissionId" replace />} />
            
            {/* Equipment - Admin only */}
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
            
            {/* Calls - Admin and Call Staff */}
            <Route
              path="/calls"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin', 'call_staff']}>
                    <CallLog />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calls/metrics"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <CallMetrics />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirects */}
            <Route path="/admin/calls" element={<Navigate to="/calls" replace />} />
            <Route path="/admin/calls/metrics" element={<Navigate to="/calls/metrics" replace />} />
            
            {/* Job Map - Admin and Call Staff */}
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
            
            {/* Users - Admin only */}
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
                    <UserManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy route redirect */}
            <Route path="/admin/users" element={<Navigate to="/users" replace />} />
            
            {/* Locations - Admin only */}
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
            
            {/* Settings - Admin only */}
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
            <Route
              path="/settings/integrations"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['admin']}>
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
