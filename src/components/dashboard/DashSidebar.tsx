import { BrandMark } from "@/components/site/Brand";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ChevronLeft,
  FileText,
  Headset,
  LayoutGrid,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export const DASH_NAV = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "quotes", label: "My quotes", Icon: FileText },
  { id: "coverage", label: "Coverage", Icon: ShieldCheck },
  { id: "concierge", label: "Concierge", Icon: Headset },
] as const;

export type DashView = (typeof DASH_NAV)[number]["id"];

export const SIDEBAR_STORAGE_KEY = "cosmic-vault-sidebar-collapsed";

type DashSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  view: DashView;
  onNavigate: (view: DashView) => void;
  quoteCount: number;
  initials: string;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
};

export function DashSidebar({
  collapsed,
  onToggle,
  view,
  onNavigate,
  quoteCount,
  initials,
  userName,
  userEmail,
  onSignOut,
}: DashSidebarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 84 : 268 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }
      }
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-background will-change-[width] lg:flex"
    >
      <div className="flex h-full flex-col px-3 py-5">
        {/* Brand + collapse control */}
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "flex-col justify-center gap-3" : "justify-between",
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-8 shrink-0 text-ink" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="wordmark"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex min-w-0 flex-col leading-none"
                >
                  <span className="truncate text-[1.02rem] font-semibold tracking-[-0.03em] text-ink">
                    Cosmic Vault
                  </span>
                  <span className="mt-1 text-[0.52rem] font-medium uppercase tracking-[0.3em] text-ink/45">
                    Member vault
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink/50 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="grid place-items-center"
            >
              <ChevronLeft className="size-3.5" />
            </motion.span>
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Vault" className="mt-8 flex-1 space-y-1">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                key="nav-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 pb-2 text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-ink/35"
              >
                Navigation
              </motion.p>
            )}
          </AnimatePresence>

          {DASH_NAV.map(({ id, label, Icon }) => {
            const active = view === id;
            const showBadge = id === "quotes" && quoteCount > 0;

            const button = (
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  collapsed ? "justify-center px-0" : "px-3",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-ink/60 hover:bg-primary/8 hover:text-primary",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.9} />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="truncate whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {showBadge && !collapsed && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[0.6rem] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-ink/8 text-ink/60",
                    )}
                  >
                    {quoteCount}
                  </span>
                )}
                {showBadge && collapsed && (
                  <span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-primary" />
                )}
              </button>
            );

            if (!collapsed) return <div key={id}>{button}</div>;

            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Concierge + account */}
        <div className="mt-4 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            {collapsed ? (
              <motion.div
                key="concierge-mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onNavigate("concierge")}
                      aria-label="Open concierge"
                      className="grid h-11 w-full place-items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Headset className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    Concierge — 24/7
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : (
              <motion.div
                key="concierge-card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="starfield relative overflow-hidden rounded-2xl bg-[#071227] p-4 text-bone"
              >
                <span className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/30 blur-2xl" />
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-bone/45">
                  Concierge
                </p>
                <p className="mt-2 text-sm font-medium leading-5">
                  A human is awake, whenever you need one.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("concierge")}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-electric-soft transition-colors hover:text-white"
                >
                  Open the line
                  <ArrowUpRight className="size-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "flex items-center gap-2.5 border-t border-line pt-4",
              collapsed ? "flex-col gap-2" : "px-1",
            )}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-[0.68rem] font-semibold text-background"
              title={userName}
            >
              {initials}
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  key="user-meta"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-xs font-semibold text-ink">
                    {userName}
                  </p>
                  <p className="truncate text-[0.68rem] text-muted-foreground">
                    {userEmail}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="grid size-8 shrink-0 place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
