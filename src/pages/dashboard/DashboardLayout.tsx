import { Brand, BrandMark } from "@/components/site/Brand";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { normalizeRole, STAFF_PERMISSIONS, can, isStaff } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  Headset,
  LayoutGrid,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  PackageSearch,
  ScrollText,
  Settings2,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router";
import { toast } from "sonner";

type NavItem = {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  end?: boolean;
};

const CUSTOMER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
  { to: "/dashboard/catalogue", label: "Products", Icon: Store },
  { to: "/dashboard/quotes", label: "Quotations", Icon: FileText },
  { to: "/dashboard/applications", label: "Applications", Icon: ClipboardList },
  { to: "/dashboard/policies", label: "Policies", Icon: ScrollText },
  { to: "/dashboard/claims", label: "Claims", Icon: LifeBuoy },
  { to: "/dashboard/payments", label: "Payments", Icon: CreditCard },
  { to: "/dashboard/documents", label: "Documents", Icon: FolderOpen },
  { to: "/dashboard/support", label: "Support", Icon: Headset },
  { to: "/dashboard/profile", label: "Profile", Icon: UserRound },
];

const BROKER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
  { to: "/dashboard/broker/customers", label: "My customers", Icon: Users },
  { to: "/dashboard/catalogue", label: "Products", Icon: Store },
  { to: "/dashboard/quotes", label: "Quotations", Icon: FileText },
  { to: "/dashboard/applications", label: "Applications", Icon: ClipboardList },
  { to: "/dashboard/policies", label: "Policies", Icon: ScrollText },
  { to: "/dashboard/broker/reports", label: "Reports", Icon: CalendarClock },
  { to: "/dashboard/support", label: "Support", Icon: Headset },
  { to: "/dashboard/profile", label: "Profile", Icon: UserRound },
];

function adminNav(permissions: string[] | undefined, role?: string): NavItem[] {
  const items: NavItem[] = [
    { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
  ];
  const allow = (permission: string) => can(role, permissions, permission);
  if (allow(STAFF_PERMISSIONS.CUSTOMERS_VIEW)) {
    items.push({ to: "/dashboard/admin/customers", label: "Customers", Icon: Users });
  }
  if (allow(STAFF_PERMISSIONS.PRODUCTS_MANAGE)) {
    items.push({ to: "/dashboard/admin/products", label: "Products", Icon: PackageSearch });
  }
  if (allow(STAFF_PERMISSIONS.APPLICATIONS_REVIEW)) {
    items.push({ to: "/dashboard/admin/applications", label: "Underwriting", Icon: ClipboardList });
  }
  if (allow(STAFF_PERMISSIONS.POLICIES_MANAGE)) {
    items.push({ to: "/dashboard/admin/policies", label: "Policies", Icon: ScrollText });
  }
  if (allow(STAFF_PERMISSIONS.CLAIMS_REVIEW)) {
    items.push({ to: "/dashboard/admin/claims", label: "Claims", Icon: LifeBuoy });
  }
  if (allow(STAFF_PERMISSIONS.PAYMENTS_VIEW)) {
    items.push({ to: "/dashboard/admin/payments", label: "Payments", Icon: Wallet });
  }
  if (allow(STAFF_PERMISSIONS.BROKERS_MANAGE)) {
    items.push({ to: "/dashboard/admin/brokers", label: "Brokers", Icon: Store });
  }
  if (allow(STAFF_PERMISSIONS.REPORTS_VIEW)) {
    items.push({ to: "/dashboard/admin/reports", label: "Reports", Icon: CalendarClock });
  }
  if (allow(STAFF_PERMISSIONS.CUSTOMERS_VIEW)) {
    items.push({ to: "/dashboard/admin/support", label: "Support", Icon: Headset });
  }
  if (allow(STAFF_PERMISSIONS.AUDIT_VIEW)) {
    items.push({ to: "/dashboard/admin/audit", label: "Audit log", Icon: ShieldCheck });
  }
  if (allow(STAFF_PERMISSIONS.SETTINGS_MANAGE)) {
    items.push({ to: "/dashboard/admin/settings", label: "Settings", Icon: Settings2 });
  }
  return items;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: ("admin" | "super_admin" | "broker" | "customer")[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const role = normalizeRole(user?.role);
  if (!roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can(user?.role, user?.permissions, permission)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card p-6 text-center">
        <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-ink">
          Access restricted
        </h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Your account does not include the permission required for this area. Ask a super admin to
          review your staff permissions. This check is enforced on the server as well.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Dashboard" className="space-y-1">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-ink/60 hover:bg-primary/8 hover:text-primary",
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useQuery(api.notifications.mine, { limit: 25 });
  const markAllRead = useMutation(api.notifications.markAllRead);
  const status = useQuery(api.setup.status);
  const bootstrap = useMutation(api.setup.bootstrap);

  const role = normalizeRole(user?.role);
  const permissions = user?.permissions ?? [];
  const nav = isStaff(role) ? adminNav(permissions, role) : role === "broker" ? BROKER_NAV : CUSTOMER_NAV;
  const unread = (notifications ?? []).filter((item) => !item.readAt).length;

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out.");
    navigate("/");
  };

  const claimAdmin = async () => {
    try {
      const result = await bootstrap();
      toast.success(
        result.promoted
          ? "Founding super admin claimed."
          : "A super admin already exists.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not claim access.");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[258px] shrink-0 flex-col border-r border-line bg-background px-3 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <BrandMark className="size-8 text-ink" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[1rem] font-semibold tracking-[-0.03em] text-ink">
              Cosmic Vault
            </span>
            <span className="mt-1 text-[0.5rem] font-medium uppercase tracking-[0.28em] text-ink/45">
              {role === "broker" ? "Broker desk" : isStaff(role) ? "Operations" : "Member vault"}
            </span>
          </span>
        </div>

        <div className="mt-7 flex-1 overflow-y-auto px-1">
          <NavList items={nav} />
        </div>

        <div className="mt-4 space-y-3 px-1">
          <div className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user?.name ?? user?.email ?? "M").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink">
                  {user?.name ?? "Vault member"}
                </p>
                <p className="truncate text-[0.62rem] capitalize text-muted-foreground">
                  {role.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open dashboard menu"
                  className="grid size-9 place-items-center rounded-full border border-line text-ink"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] overflow-y-auto bg-background p-5">
                <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                <Brand href="/" className="text-ink" />
                <div className="mt-7">
                  <NavList items={nav} onNavigate={() => setMenuOpen(false)} />
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-7 flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-xs font-medium text-muted-foreground"
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </SheetContent>
            </Sheet>
            <Brand href="/" compact className="text-ink lg:hidden" />
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <span className="capitalize">{role.replace("_", " ")} workspace</span>
            <ChevronRight className="size-3" />
            <span>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9" />
            <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                  className="relative grid size-9 place-items-center rounded-full border border-line text-ink"
                >
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[0.55rem] font-semibold text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full overflow-y-auto bg-background p-5 sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="text-base tracking-tight">Notifications</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{unread} unread</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await markAllRead();
                      toast.success("All caught up.");
                    }}
                    className="text-xs font-medium text-primary"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {notifications === undefined ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
                  ) : notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      Nothing needs your attention.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => {
                          if (item.href) navigate(item.href);
                          setNotificationsOpen(false);
                        }}
                        className={cn(
                          "block w-full rounded-xl border px-4 py-3 text-left transition-colors hover:border-primary/30",
                          item.readAt ? "border-line bg-card" : "border-primary/25 bg-primary/[0.04]",
                        )}
                      >
                        <p className="text-xs font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">{item.body}</p>
                        <p className="mt-1.5 text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                          {item.emailStatus === "failed" && " · email failed"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="hidden h-9 rounded-full px-3 text-xs sm:inline-flex"
            >
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 sm:px-7 sm:py-9">
          {status && !status.hasSuperAdmin && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-halo/50 bg-halo/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Founding administrator setup</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  No super admin exists yet. The first signed-in user can claim the founding role,
                  then create products and staff accounts. This option disappears permanently once
                  a super admin exists.
                </p>
              </div>
              <Button onClick={claimAdmin} className="h-9 shrink-0 rounded-full px-4 text-xs">
                Claim super admin
              </Button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
