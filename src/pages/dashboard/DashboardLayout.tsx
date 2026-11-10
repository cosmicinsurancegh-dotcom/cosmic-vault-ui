import { BrandMark } from "@/components/site/Brand";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useIdleSignOut } from "@/hooks/use-idle-sign-out";
import { IDLE_SIGN_OUT_MS } from "@/lib/idleSignOut";
import { useVaultActor } from "@/lib/vault/useVault";
import { api } from "@/convex/_generated/api";
import {
  forgetThemePreference,
  preferencesAllowed,
  requestCookieSettings,
} from "@/lib/consent";
import {
  normalizeRole,
  STAFF_PERMISSIONS,
  can,
  isStaff,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { initials } from "@/lib/vault";
import { useMutation, useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cookie,
  CreditCard,
  FileText,
  FolderOpen,
  Gem,
  Headset,
  LayoutGrid,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import { toast } from "sonner";

type NavItem = {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  end?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const RAIL_STORAGE_KEY = "cosmic-vault-dashboard-rail";
const RAIL_EXPANDED_WIDTH = 272;
const RAIL_COLLAPSED_WIDTH = 82;

const CUSTOMER_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
    ],
  },
  {
    label: "Vault",
    items: [
      { to: "/dashboard/vault", label: "My minerals", Icon: Gem },
      { to: "/dashboard/shipments", label: "Shipments", Icon: Truck },
    ],
  },
  {
    label: "Cover",
    items: [
      { to: "/dashboard/catalogue", label: "Products", Icon: Store },
      { to: "/dashboard/quotes", label: "Quotations", Icon: FileText },
      {
        to: "/dashboard/applications",
        label: "Applications",
        Icon: ClipboardList,
      },
      { to: "/dashboard/policies", label: "Policies", Icon: ScrollText },
      { to: "/dashboard/claims", label: "Claims", Icon: LifeBuoy },
    ],
  },
  {
    label: "Money & records",
    items: [
      { to: "/dashboard/payments", label: "Payments", Icon: CreditCard },
      { to: "/dashboard/documents", label: "Documents", Icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/support", label: "Support", Icon: Headset },
      { to: "/dashboard/profile", label: "Profile", Icon: UserRound },
    ],
  },
];

/* The guest operations preview only unlocks the vault floor, so its rail is
   deliberately narrower than a staff account's. It shows the same pages a
   demonstration reviewer is allowed to open, and nothing that would bounce
   them back to the member overview. */
const DEMO_OPERATIONS_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/dashboard/admin/vault", label: "Vault register", Icon: Gem },
      { to: "/dashboard/admin/shipments", label: "Shipment control", Icon: Truck },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/support", label: "Support", Icon: Headset },
      { to: "/dashboard/profile", label: "Profile", Icon: UserRound },
    ],
  },
];

const BROKER_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
    ],
  },
  {
    label: "Your book",
    items: [
      { to: "/dashboard/broker/customers", label: "My customers", Icon: Users },
      { to: "/dashboard/catalogue", label: "Products", Icon: Store },
      { to: "/dashboard/quotes", label: "Quotations", Icon: FileText },
      {
        to: "/dashboard/applications",
        label: "Applications",
        Icon: ClipboardList,
      },
      { to: "/dashboard/policies", label: "Policies", Icon: ScrollText },
      { to: "/dashboard/minerals", label: "Minerals", Icon: Gem },
      {
        to: "/dashboard/broker/reports",
        label: "Reports",
        Icon: CalendarClock,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/support", label: "Support", Icon: Headset },
      { to: "/dashboard/profile", label: "Profile", Icon: UserRound },
    ],
  },
];

function adminNav(
  permissions: string[] | undefined,
  role?: string,
): NavGroup[] {
  const allow = (permission: string) => can(role, permissions, permission);
  const operations: NavItem[] = [
    { to: "/dashboard/admin/vault", label: "Vault", Icon: Gem },
    { to: "/dashboard/admin/shipments", label: "Shipments", Icon: Truck },
  ];
  if (allow(STAFF_PERMISSIONS.POLICIES_MANAGE)) {
    operations.push({
      to: "/dashboard/admin/minerals",
      label: "Minerals",
      Icon: Gem,
    });
  }
  if (allow(STAFF_PERMISSIONS.CUSTOMERS_VIEW)) {
    operations.push({
      to: "/dashboard/admin/customers",
      label: "Customers",
      Icon: Users,
    });
  }
  if (allow(STAFF_PERMISSIONS.PRODUCTS_MANAGE)) {
    operations.push({
      to: "/dashboard/admin/products",
      label: "Products",
      Icon: PackageSearch,
    });
  }
  if (allow(STAFF_PERMISSIONS.APPLICATIONS_REVIEW)) {
    operations.push({
      to: "/dashboard/admin/applications",
      label: "Underwriting",
      Icon: ClipboardList,
    });
  }
  if (allow(STAFF_PERMISSIONS.POLICIES_MANAGE)) {
    operations.push({
      to: "/dashboard/admin/policies",
      label: "Policies",
      Icon: ScrollText,
    });
  }
  if (allow(STAFF_PERMISSIONS.CLAIMS_REVIEW)) {
    operations.push({
      to: "/dashboard/admin/claims",
      label: "Claims",
      Icon: LifeBuoy,
    });
  }
  if (allow(STAFF_PERMISSIONS.PAYMENTS_VIEW)) {
    operations.push({
      to: "/dashboard/admin/payments",
      label: "Payments",
      Icon: Wallet,
    });
  }
  if (allow(STAFF_PERMISSIONS.BROKERS_MANAGE)) {
    operations.push({
      to: "/dashboard/admin/brokers",
      label: "Brokers",
      Icon: Store,
    });
  }

  const insight: NavItem[] = [];
  if (allow(STAFF_PERMISSIONS.REPORTS_VIEW)) {
    insight.push({
      to: "/dashboard/admin/reports",
      label: "Reports",
      Icon: CalendarClock,
    });
  }
  if (allow(STAFF_PERMISSIONS.AUDIT_VIEW)) {
    insight.push({
      to: "/dashboard/admin/audit",
      label: "Audit log",
      Icon: ShieldCheck,
    });
  }

  const account: NavItem[] = [];
  if (allow(STAFF_PERMISSIONS.CUSTOMERS_VIEW)) {
    account.push({
      to: "/dashboard/admin/support",
      label: "Support",
      Icon: Headset,
    });
  }
  if (allow(STAFF_PERMISSIONS.SETTINGS_MANAGE)) {
    account.push({
      to: "/dashboard/admin/settings",
      label: "Settings",
      Icon: Settings2,
    });
  }
  account.push({
    to: "/dashboard/profile",
    label: "Profile",
    Icon: UserRound,
  });

  return [
    {
      label: "Workspace",
      items: [
        { to: "/dashboard", label: "Overview", Icon: LayoutGrid, end: true },
      ],
    },
    { label: "Operations", items: operations },
    { label: "Insight", items: insight },
    { label: "Account", items: account },
  ].filter((group) => group.items.length > 0);
}

function roleLabel(role: string) {
  if (role === "broker") return "Broker desk";
  if (role === "admin" || role === "super_admin") return "Operations";
  return "Member vault";
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

export function RequireVaultOperations({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const { actor } = useVaultActor();
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isStaff(user?.role)) return <>{children}</>;
  if (user?.isAnonymous && actor.role === "admin") return <>{children}</>;
  return <Navigate to="/dashboard" replace />;
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
          Your account does not include the permission required for this area.
          Ask a super admin to review your staff permissions. This check is
          enforced on the server as well.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function SidebarBody({
  groups,
  collapsed,
  onToggle,
  onNavigate,
  onSearch,
  userName,
  userEmail,
  userRole,
  onSignOut,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  onSearch: () => void;
  userName: string;
  userEmail: string;
  userRole: string;
  onSignOut: () => void;
}) {
  const searchButton = (
    <button
      type="button"
      onClick={onSearch}
      aria-label="Search workspace"
      className={cn(
        "mt-5 flex h-9 items-center rounded-[4px] border border-line bg-card text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        collapsed ? "mx-auto w-10 justify-center" : "w-full gap-2 px-3",
      )}
    >
      <Search className="size-3.5 shrink-0" strokeWidth={1.9} />
      {!collapsed && (
        <>
          <span className="truncate">Search workspace</span>
          <kbd className="ml-auto rounded-md border border-line bg-ink/[0.03] px-1.5 py-0.5 font-sans text-[0.55rem] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </>
      )}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-4">
      <div
        className={cn(
          "flex items-center gap-2",
          collapsed ? "flex-col justify-center gap-3" : "justify-between",
        )}
      >
        <NavLink
          to="/"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80",
            collapsed && "justify-center",
          )}
          aria-label="Cosmic Vault home"
        >
          <BrandMark className="size-8 shrink-0" />
          <span
            className={cn(
              "flex min-w-0 flex-col overflow-hidden leading-none transition-all duration-200",
              collapsed
                ? "w-0 -translate-x-1 opacity-0"
                : "w-auto translate-x-0 opacity-100",
            )}
          >
            <span className="truncate text-[0.98rem] font-semibold tracking-[-0.03em] text-ink">
              Cosmic Vault
            </span>
            <span className="mt-1 truncate text-[0.5rem] font-medium uppercase tracking-[0.26em] text-ink/45">
              {userRole}
            </span>
          </span>
        </NavLink>

        {onToggle && (
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                className="grid size-8 shrink-0 place-items-center rounded-[4px] border border-line bg-card text-ink/50 transition-colors hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-3.5" />
                ) : (
                  <PanelLeftClose className="size-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {collapsed ? "Expand" : "Collapse"} sidebar
              <span className="ml-1.5 opacity-50">⌘B</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {collapsed ? (
        <Tooltip delayDuration={180}>
          <TooltipTrigger asChild>{searchButton}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            Search <span className="ml-1.5 opacity-50">⌘K</span>
          </TooltipContent>
        </Tooltip>
      ) : (
        searchButton
      )}

      <nav
        aria-label="Dashboard"
        className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pb-2 pr-0.5"
      >
        {groups.map((group, groupIndex) => (
          <div key={group.label}>
            <div className={cn("pb-1.5", collapsed ? "px-2" : "px-3")}>
              {collapsed ? (
                groupIndex > 0 && <div className="h-px w-full bg-line/70" />
              ) : (
                <p className="text-[0.54rem] font-semibold uppercase tracking-[0.22em] text-ink/35">
                  {group.label}
                </p>
              )}
            </div>

            <div className="space-y-0.5">
              {group.items.map(({ to, label, Icon, end }) => {
                const link = (
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    aria-label={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex w-full items-center rounded-xl text-[0.79rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        collapsed
                          ? "justify-center px-0 py-2.5"
                          : "gap-2.5 px-3 py-2.5",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_rgba(29,116,245,0.85)]"
                          : "text-ink/60 hover:bg-primary/[0.06] hover:text-primary",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            "size-[17px] shrink-0 transition-transform duration-200",
                            !isActive && "group-hover:translate-x-0.5",
                          )}
                          strokeWidth={1.85}
                        />
                        <span
                          aria-hidden={collapsed}
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-all duration-200",
                            collapsed
                              ? "w-0 -translate-x-1 opacity-0"
                              : "w-auto translate-x-0 opacity-100",
                          )}
                        >
                          {label}
                        </span>
                        {!collapsed && isActive && (
                          <span
                            aria-hidden="true"
                            className="ml-auto size-1.5 rounded-[4px] bg-primary-foreground/70"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (!collapsed) return <div key={to}>{link}</div>;

                return (
                  <Tooltip key={to} delayDuration={180}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12}>
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-2 space-y-3">
        {collapsed ? (
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <NavLink
                to="/dashboard/support"
                onClick={onNavigate}
                aria-label="Open support"
                className="grid h-10 w-full place-items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Headset className="size-4" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              Support
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="starfield relative overflow-hidden rounded-2xl bg-[#071227] p-3.5 text-bone">
            <span className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.35),transparent_65%)]" />
            <p className="relative text-[0.52rem] font-semibold uppercase tracking-[0.22em] text-bone/45">
              Concierge
            </p>
            <p className="relative mt-1.5 text-[0.7rem] leading-5 text-bone/75">
              A person with your file in front of them.
            </p>
            <NavLink
              to="/dashboard/support"
              onClick={onNavigate}
              className="relative mt-2.5 inline-flex items-center gap-1 text-[0.65rem] font-semibold text-electric-soft transition-colors hover:text-bone"
            >
              Open support
              <ChevronRight className="size-3" />
            </NavLink>
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl border border-line bg-card/80 p-2.5",
            collapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center gap-2.5",
          )}
        >
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <span className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-primary/10 text-[0.62rem] font-semibold text-primary">
                {initials(userName || userEmail)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {userName}
              <span className="block text-[0.62rem] opacity-60">
                {userEmail}
              </span>
            </TooltipContent>
          </Tooltip>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.72rem] font-medium text-ink">
                {userName}
              </p>
              <p className="truncate text-[0.58rem] text-muted-foreground">
                {userEmail}
              </p>
            </div>
          )}
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ink/40 transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <LogOut className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>
              Sign out
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { resolvedTheme, setTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(RAIL_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notifications = useQuery(api.notifications.mine, { limit: 25 });
  const markAllRead = useMutation(api.notifications.markAllRead);
  const status = useQuery(api.setup.status);
  const bootstrap = useMutation(api.setup.bootstrap);

  const role = normalizeRole(user?.role);
  const permissions = user?.permissions ?? [];
  const staff = isStaff(role);
  const {
    actor: vaultActor,
    canSwitchDemoRole,
  } = useVaultActor();
  /* An anonymous visitor can preview the operations side of the vault. The
     rail, breadcrumb and identity all follow that switch, so the preview never
     looks like a member workspace with administrator data dropped into it. */
  const demoOperations = canSwitchDemoRole && vaultActor.role === "admin";
  const groups = staff
    ? adminNav(permissions, role)
    : demoOperations
      ? DEMO_OPERATIONS_NAV
      : role === "broker"
        ? BROKER_NAV
        : CUSTOMER_NAV;

  const unread = (notifications ?? []).filter((item) => !item.readAt).length;
  /* The guest vault is Noor Haddad's demonstration collection. Showing the
     owner's name in the rail keeps the member preview consistent with the
     greeting and the records, instead of labelling it "Anonymous session". */
  const memberDemo = canSwitchDemoRole && vaultActor.role === "client";
  const userName =
    demoOperations || memberDemo
      ? vaultActor.name
      : user?.name ?? "Vault member";
  const userEmail =
    demoOperations || memberDemo
      ? vaultActor.email
      : user?.email ?? "Anonymous session";
  const label = demoOperations ? "Operations" : roleLabel(role);

  const activeItem = useMemo(() => {
    const items = groups
      .flatMap((group) => group.items)
      .slice()
      .sort((a, b) => b.to.length - a.to.length);
    return items.find((item) =>
      item.to === "/dashboard"
        ? location.pathname === "/dashboard"
        : location.pathname.startsWith(item.to),
    );
  }, [groups, location.pathname]);

  useEffect(() => {
    /* The collapsed rail is an optional preference, so it is only remembered
       when the visitor has allowed interface storage. */
    if (!preferencesAllowed()) return;
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage can be unavailable in sandboxed previews - collapsing still works.
    }
  }, [collapsed]);

  /* The consent panel is fixed to the viewport and mounted above the router,
     so it cannot measure this rail directly. Publishing the current width as
     a CSS variable keeps the panel clear of the account card (and its sign-out
     button) at the foot of the sidebar. It is cleared on leaving the
     dashboard, where the panel returns to the viewport corner. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--dashboard-rail-width",
      `${collapsed ? RAIL_COLLAPSED_WIDTH : RAIL_EXPANDED_WIDTH}px`,
    );
    return () => {
      root.style.removeProperty("--dashboard-rail-width");
    };
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (key === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out.");
    navigate("/");
  };

  /* An unattended screen should not keep a vault open. When the deadline
     passes, the session is closed here and `RequireAuth` hands the visitor to
     the sign-in page with the current page kept as `returnTo`. */
  const handleIdleSignOut = useCallback(() => {
    void signOut().then(() =>
      toast(
        `Signed out after ${Math.round(
          IDLE_SIGN_OUT_MS / 60_000,
        )} minutes of inactivity.`,
      ),
    );
  }, [signOut]);

  useIdleSignOut(handleIdleSignOut);

  const claimAdmin = async () => {
    try {
      const result = await bootstrap();
      toast.success(
        result.promoted
          ? "Founding super admin claimed."
          : "A super admin already exists.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not claim access.",
      );
    }
  };

  const openSearch = () => {
    setMobileOpen(false);
    setPaletteOpen(true);
  };

  return (
    <>
      <div className="flex min-h-screen bg-background">
        <motion.aside
          initial={false}
          animate={{
            width: collapsed ? RAIL_COLLAPSED_WIDTH : RAIL_EXPANDED_WIDTH,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 250, damping: 32, mass: 0.9 }
          }
          className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-line bg-[linear-gradient(180deg,var(--card),var(--background))] will-change-[width] lg:block"
        >
          <SidebarBody
            groups={groups}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            onSearch={openSearch}
            userName={userName}
            userEmail={userEmail}
            userRole={label}
            onSignOut={handleSignOut}
          />
        </motion.aside>

        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--ice) 38%, transparent), transparent 420px)",
          }}
        >
          <header className="sticky top-0 z-30 border-b border-line/80 bg-background/85 backdrop-blur-xl">
            <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open dashboard menu"
                    className="grid size-9 shrink-0 place-items-center rounded-[4px] border border-line text-ink lg:hidden"
                  >
                    <Menu className="size-4" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[286px] overflow-hidden bg-background p-0"
                >
                  <SheetTitle className="sr-only">
                    Dashboard navigation
                  </SheetTitle>
                  <SidebarBody
                    groups={groups}
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                    onSearch={openSearch}
                    userName={userName}
                    userEmail={userEmail}
                    userRole={label}
                    onSignOut={handleSignOut}
                  />
                </SheetContent>
              </Sheet>

              <NavLink
                to="/dashboard"
                className="flex items-center gap-2 lg:hidden"
                aria-label="Cosmic Vault dashboard"
              >
                <BrandMark className="size-6" />
                <span className="text-xs font-semibold tracking-[-0.02em] text-ink sm:text-[0.8rem]">
                  Cosmic Vault
                </span>
              </NavLink>

              <div className="hidden min-w-0 items-center gap-2 text-[0.68rem] text-muted-foreground md:flex">
                <span className="truncate">{label}</span>
                <ChevronRight className="size-3 shrink-0 opacity-50" />
                <span className="truncate font-medium text-ink">
                  {activeItem?.label ?? "Overview"}
                </span>
              </div>

              <button
                type="button"
                onClick={openSearch}
                className="ml-auto hidden h-9 w-full max-w-[260px] items-center gap-2 rounded-[4px] border border-line bg-card px-3.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:flex"
              >
                <Search className="size-3.5 shrink-0" />
                <span>Search workspace</span>
                <kbd className="ml-auto rounded-md border border-line bg-ink/[0.03] px-1.5 py-0.5 font-sans text-[0.55rem] font-semibold">
                  ⌘K
                </kbd>
              </button>

              <div className="ml-auto flex items-center gap-1.5 md:ml-2">
                <ThemeToggle className="size-9" />

                <Sheet
                  open={notificationsOpen}
                  onOpenChange={setNotificationsOpen}
                >
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                      className="relative grid size-9 place-items-center rounded-[4px] border border-line text-ink transition-colors hover:border-primary/30"
                    >
                      <Bell className="size-4" />
                      {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-[4px] bg-primary text-[0.52rem] font-semibold text-primary-foreground ring-2 ring-background">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-full overflow-y-auto bg-background p-5 sm:max-w-md"
                  >
                    <SheetHeader>
                      <SheetTitle className="text-base tracking-tight">
                        Notifications
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {unread} unread
                      </p>
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
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          Loading…
                        </p>
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
                              item.readAt
                                ? "border-line bg-card"
                                : "border-primary/25 bg-primary/[0.04]",
                            )}
                          >
                            <p className="text-xs font-semibold text-ink">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
                              {item.body}
                            </p>
                            <p className="mt-1.5 text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
                              {formatDateTime(item.createdAt)}
                              {item.emailStatus === "failed" &&
                                " · email failed"}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-2 rounded-[4px] border border-line bg-card pl-1 pr-2 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span className="grid size-7 place-items-center rounded-[4px] bg-primary/10 text-[0.58rem] font-semibold text-primary">
                        {initials(userName || userEmail)}
                      </span>
                      <span className="hidden max-w-[110px] truncate text-[0.7rem] font-medium text-ink xl:block">
                        {userName}
                      </span>
                      <ChevronDown className="hidden size-3 text-muted-foreground sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs font-medium text-ink">{userName}</p>
                      <p className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">
                        {userEmail}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        if (staff) {
                          navigate("/dashboard/admin/settings");
                        } else if (demoOperations) {
                          navigate("/dashboard/admin/vault");
                        } else {
                          navigate("/dashboard/profile");
                        }
                      }}
                    >
                      <Settings2 className="size-3.5" />
                      {staff
                        ? "Workspace settings"
                        : demoOperations
                          ? "Vault register"
                          : "Profile"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => requestCookieSettings()}>
                      <Cookie className="size-3.5" />
                      Cookie settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut}>
                      <LogOut className="size-3.5" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="relative mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {status && !status.hasSuperAdmin && (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-halo/50 bg-halo/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Founding administrator setup
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    No super admin exists yet. The first signed-in user can
                    claim the founding role, then create products and staff
                    accounts. This option disappears permanently once a super
                    admin exists.
                  </p>
                </div>
                <Button
                  onClick={claimAdmin}
                  className="h-9 shrink-0 rounded-[4px] px-4 text-xs"
                >
                  Claim super admin
                </Button>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>

      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Search workspace"
        description="Jump to a page or run an action"
        className="sm:max-w-lg"
      >
        <CommandInput placeholder="Search pages, records, and actions…" />
        <CommandList>
          <CommandEmpty>No matches. Try a different word.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map(({ to, label: itemLabel, Icon }) => (
                <CommandItem
                  key={to}
                  value={`${itemLabel} ${to}`}
                  onSelect={() => {
                    setPaletteOpen(false);
                    navigate(to);
                  }}
                >
                  <Icon className="size-4" />
                  {itemLabel}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="toggle theme dark light appearance"
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                forgetThemePreference();
                setPaletteOpen(false);
              }}
            >
              <Settings2 className="size-4" />
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </CommandItem>
            <CommandItem
              value="sign out log out"
              onSelect={() => {
                setPaletteOpen(false);
                handleSignOut();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
