import { Toaster } from "@/components/ui/sonner";
import { BackendHealthNotice } from "@/components/dashboard/BackendHealthNotice";
import { RequireAuth } from "@/components/RequireAuth";
import { CookieConsent } from "@/components/site/CookieConsent";
import { MissingConvexConfig } from "@/components/site/MissingConvexConfig";
import { PublicLayout } from "@/components/site/PublicLayout";
import { PUBLIC_ROUTES } from "@/lib/publicRoutes";
import { isConvexDeploymentUrl, resolveConvexUrl } from "@/lib/convexUrl";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const HeroLab = lazy(() => import("./pages/HeroLab.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const DashboardLayout = lazy(
  () => import("./pages/dashboard/DashboardLayout.tsx"),
);
const Home = lazy(() => import("./pages/dashboard/Home.tsx"));
const CataloguePage = lazy(() => import("./pages/dashboard/CataloguePage.tsx"));
const QuotesPage = lazy(() => import("./pages/dashboard/QuotesPage.tsx"));
const ApplicationsPage = lazy(
  () => import("./pages/dashboard/ApplicationsPage.tsx"),
);
const PoliciesPage = lazy(() => import("./pages/dashboard/PoliciesPage.tsx"));
const VaultPage = lazy(() => import("./pages/dashboard/VaultPage.tsx"));
const ShipmentsPage = lazy(() => import("./pages/dashboard/ShipmentsPage.tsx"));
const AdminVaultPage = lazy(() => import("./pages/dashboard/AdminVaultPage.tsx"));
const AdminShipmentsPage = lazy(
  () => import("./pages/dashboard/AdminShipmentsPage.tsx"),
);
const MineralsPage = lazy(() => import("./pages/dashboard/MineralsPage.tsx"));
const ClaimsPage = lazy(() => import("./pages/dashboard/ClaimsPage.tsx"));
const ProfilePage = lazy(() => import("./pages/dashboard/ProfilePage.tsx"));
const SupportPage = lazy(() => import("./pages/dashboard/SupportPage.tsx"));
const AdminProductsPage = lazy(
  () => import("./pages/dashboard/AdminProducts.tsx"),
);
const AdminMineralsPage = lazy(
  () => import("./pages/dashboard/AdminMinerals.tsx"),
);
const AdminUnderwritingPage = lazy(
  () => import("./pages/dashboard/AdminUnderwriting.tsx"),
);
const AdminServicingPage = lazy(
  () => import("./pages/dashboard/AdminServicing.tsx"),
);
const AdminClaimsPage = lazy(() => import("./pages/dashboard/AdminClaims.tsx"));
const AdminBrokersPage = lazy(
  () => import("./pages/dashboard/AdminBrokers.tsx"),
);
const AdminReportsPage = lazy(
  () => import("./pages/dashboard/AdminReports.tsx"),
);
const AdminAuditPage = lazy(() => import("./pages/dashboard/AdminAudit.tsx"));
const AdminSettingsPage = lazy(
  () => import("./pages/dashboard/AdminSettings.tsx"),
);
const AdminCustomersPage = lazy(() =>
  import("./pages/dashboard/AdminCustomers.tsx").then((module) => ({
    default: module.AdminCustomersPage,
  })),
);
const AdminSupportPage = lazy(() =>
  import("./pages/dashboard/AdminCustomers.tsx").then((module) => ({
    default: module.AdminSupportPage,
  })),
);
const AdminPaymentsPage = lazy(() =>
  import("./pages/dashboard/AdminFinance.tsx").then((module) => ({
    default: module.AdminPaymentsPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./pages/dashboard/MoneyPage.tsx").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const PaymentsPage = lazy(() =>
  import("./pages/dashboard/MoneyPage.tsx").then((module) => ({
    default: module.PaymentsPage,
  })),
);
const BrokerCustomersPage = lazy(() =>
  import("./pages/dashboard/BrokerWorkspace.tsx").then((module) => ({
    default: module.BrokerCustomersPage,
  })),
);
const BrokerReportsPage = lazy(() =>
  import("./pages/dashboard/BrokerWorkspace.tsx").then((module) => ({
    default: module.BrokerReportsPage,
  })),
);
const RequireRole = lazy(() =>
  import("./pages/dashboard/DashboardLayout.tsx").then((module) => ({
    default: module.RequireRole,
  })),
);
const RequirePermission = lazy(() =>
  import("./pages/dashboard/DashboardLayout.tsx").then((module) => ({
    default: module.RequirePermission,
  })),
);
const RequireVaultOperations = lazy(() =>
  import("./pages/dashboard/DashboardLayout.tsx").then((module) => ({
    default: module.RequireVaultOperations,
  })),
);

function StaffOnly({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin", "super_admin"]}>{children}</RequireRole>;
}

function SelfServiceOnly({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["customer", "broker"]}>{children}</RequireRole>;
}

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary - if VlyToolbar crashes it renders nothing instead
 *  of crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// A Convex client cannot tell a wrong URL from a slow one: it just waits for a
// connection that never opens. So an unusable VITE_CONVEX_URL must never reach
// the client - it resolves to `null` and the configuration screen renders
// instead (see `@/lib/convexUrl`).
const configuredConvexUrl = import.meta.env.VITE_CONVEX_URL as
  | string
  | undefined;
const convexUrl = resolveConvexUrl(configuredConvexUrl);
if (
  import.meta.env.DEV &&
  configuredConvexUrl?.trim() &&
  !isConvexDeploymentUrl(configuredConvexUrl)
) {
  console.warn(
    `[convex] VITE_CONVEX_URL is not a Convex deployment URL ("${configuredConvexUrl}"); showing the configuration screen.`,
  );
}
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <BrowserRouter>
              <RouteSyncer />
              {/* Above the routes: a backend that runs no functions also breaks
                  the signed-in user query, so the dashboard shell never gets far
                  enough to render its own explanation. */}
              {convexUrl && <BackendHealthNotice url={convexUrl} />}
              <CookieConsent />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  {/* Design study: the three hero directions, presented full-bleed. */}
                  <Route path="/hero-lab" element={<HeroLab />} />
                  {/* Public marketing site: one shared shell with mega-menu navigation */}
                  <Route element={<PublicLayout />}>
                    <Route index element={<Landing />} />
                    {PUBLIC_ROUTES.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                      />
                    ))}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route
                    path="/auth"
                    element={<AuthPage redirectAfterAuth="/dashboard" />}
                  />
                  <Route
                    path="/login"
                    element={
                      <AuthPage
                        redirectAfterAuth="/dashboard"
                        defaultMode="signin"
                      />
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <AuthPage
                        redirectAfterAuth="/dashboard"
                        defaultMode="signup"
                      />
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <RequireAuth
                        title="Sign in to your insurance workspace"
                        description="Your policies, quotations, applications, claims, and documents live here."
                      >
                        <DashboardLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Home />} />
                    <Route
                      path="catalogue"
                      element={
                        <SelfServiceOnly>
                          <CataloguePage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="quotes"
                      element={
                        <SelfServiceOnly>
                          <QuotesPage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="applications"
                      element={
                        <SelfServiceOnly>
                          <ApplicationsPage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="policies"
                      element={
                        <SelfServiceOnly>
                          <PoliciesPage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="vault"
                      element={
                        <RequireRole roles={["customer", "broker"]}>
                          <VaultPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="shipments"
                      element={
                        <RequireRole roles={["customer"]}>
                          <ShipmentsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="admin/vault"
                      element={
                        <RequireVaultOperations>
                          <AdminVaultPage />
                        </RequireVaultOperations>
                      }
                    />
                    <Route
                      path="admin/shipments"
                      element={
                        <RequireVaultOperations>
                          <AdminShipmentsPage />
                        </RequireVaultOperations>
                      }
                    />
                    <Route
                      path="minerals"
                      element={
                        <SelfServiceOnly>
                          <MineralsPage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="claims"
                      element={
                        <RequireRole roles={["customer"]}>
                          <ClaimsPage />
                        </RequireRole>
                      }
                    />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="documents" element={<DocumentsPage />} />
                    <Route path="support" element={<SupportPage />} />
                    <Route
                      path="profile"
                      element={
                        <SelfServiceOnly>
                          <ProfilePage />
                        </SelfServiceOnly>
                      }
                    />
                    <Route
                      path="broker/customers"
                      element={
                        <RequireRole roles={["broker"]}>
                          <BrokerCustomersPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="broker/reports"
                      element={
                        <RequireRole roles={["broker"]}>
                          <BrokerReportsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="admin/customers"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="customers.view">
                            <AdminCustomersPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/products"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="products.manage">
                            <AdminProductsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/minerals"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="policies.manage">
                            <AdminMineralsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/applications"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="applications.review">
                            <AdminUnderwritingPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/policies"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="policies.manage">
                            <AdminServicingPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/claims"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="claims.review">
                            <AdminClaimsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/payments"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="payments.view">
                            <AdminPaymentsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/brokers"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="brokers.manage">
                            <AdminBrokersPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/reports"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="reports.view">
                            <AdminReportsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/support"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="customers.view">
                            <AdminSupportPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/audit"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="audit.view">
                            <AdminAuditPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                    <Route
                      path="admin/settings"
                      element={
                        <StaffOnly>
                          <RequirePermission permission="settings.manage">
                            <AdminSettingsPage />
                          </RequirePermission>
                        </StaffOnly>
                      }
                    />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ThemeProvider>
          <Toaster />
        </ConvexAuthProvider>
      ) : (
        <MissingConvexConfig />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);
