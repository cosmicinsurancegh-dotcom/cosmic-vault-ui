import { Brand } from "@/components/site/Brand";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Media } from "@/components/site/Media";
import { useAuth } from "@/hooks/use-auth";
import { IMAGES } from "@/lib/imagery";
import { NAV_SECTIONS, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

function sectionIsActive(section: NavSection, pathname: string) {
  return section.match.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function MegaPanel({
  section,
  onClose,
  focusOnOpen,
  onPointerEnter,
  onPointerLeave,
}: {
  section: NavSection;
  onClose: () => void;
  focusOnOpen: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusOnOpen) return;
    panelRef.current
      ?.querySelector<HTMLElement>("a, button")
      ?.focus();
  }, [focusOnOpen]);

  return (
    <motion.div
      ref={panelRef}
      id={`mega-${section.id}`}
      role="region"
      aria-label={`${section.label} menu`}
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="absolute inset-x-0 top-full z-50 pt-2"
    >
      <div className="overflow-hidden rounded-[1.35rem] border border-line bg-popover/98 shadow-[0_28px_80px_-36px_rgba(8,18,39,0.5)] backdrop-blur-xl">
        <div className="flex flex-col gap-8 p-5 sm:p-6 lg:flex-row">
          <div className="flex flex-1 flex-wrap gap-x-8 gap-y-7">
            {section.groups.map((group) => (
              <div key={group.title} className="min-w-[13.5rem] flex-1">
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.24em] text-ink/55">
                  {group.title}
                </p>
                <ul className="mt-3 space-y-0.5">
                  {group.links.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <motion.li
                        key={link.href}
                        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: reduceMotion ? 0 : Math.min(index * 0.014, 0.14),
                          ease: "easeOut",
                        }}
                      >
                        <Link
                          to={link.href}
                          onClick={onClose}
                          className="group flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-primary/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {Icon && (
                            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-ice text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                              <Icon className="size-3.5" strokeWidth={1.9} />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="link-slide block w-fit text-[0.82rem] font-medium leading-5 text-ink transition-colors group-hover:text-primary">
                              {link.label}
                            </span>
                            {link.description && (
                              <span className="mt-0.5 block text-[0.68rem] leading-4 text-muted-foreground">
                                {link.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="group hidden w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-card lg:flex xl:w-[18.5rem]">
            <Media
              image={section.feature.image ?? IMAGES.workspaces}
              overlay="cosmic"
              className="h-[8.25rem] w-full shrink-0"
            >
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.24em] text-bone/80">
                  {section.feature.eyebrow}
                </p>
                <span className="grid size-7 place-items-center rounded-full border border-white/25 bg-white/10 text-bone backdrop-blur transition-transform duration-500 group-hover:rotate-45">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </Media>
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <p className="text-[1.02rem] font-semibold leading-5 tracking-[-0.02em] text-ink">
                  {section.feature.title}
                </p>
                <p className="mt-2 text-[0.75rem] leading-5 text-muted-foreground">
                  {section.feature.body}
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <Link
                  to={section.feature.primary.href}
                  onClick={onClose}
                  className="group/btn flex items-center justify-between gap-2 rounded-full bg-primary py-1.5 pl-4 pr-1.5 text-[0.78rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {section.feature.primary.label}
                  <span className="grid size-6 place-items-center rounded-full bg-primary-foreground/20">
                    <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
                  </span>
                </Link>
                {section.feature.secondary && (
                  <Link
                    to={section.feature.secondary.href}
                    onClick={onClose}
                    className="flex items-center justify-between gap-2 rounded-full border border-ink/12 px-4 py-2 text-[0.75rem] font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink"
                  >
                    {section.feature.secondary.label}
                    <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-card/50 px-5 py-2.5 sm:px-6">
          <p className="hidden text-[0.65rem] text-muted-foreground sm:block">
            Indicative terms only — final cover depends on the policy wording.
          </p>
          <Link
            to={section.href}
            onClick={onClose}
            className="group ml-auto inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-ink/60 transition-colors hover:text-primary"
          >
            {section.label} overview
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function Navbar() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // Menu state is stored with the path it was opened on, so a route change
  // closes every menu without needing an effect that resets state.
  const [menuState, setMenuState] = useState<{ path: string; id: string | null }>({
    path: location.pathname,
    id: null,
  });
  const [sheetState, setSheetState] = useState<{ path: string; open: boolean }>({
    path: location.pathname,
    open: false,
  });
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openId = menuState.path === location.pathname ? menuState.id : null;
  const mobileOpen = sheetState.path === location.pathname && sheetState.open;

  /** Stable setter — safe to use inside effects without re-subscribing. */
  const closeAllMenus = () =>
    setMenuState((current) =>
      current.id === null ? current : { ...current, id: null },
    );

  const setOpenId = (id: string | null) =>
    setMenuState({ path: location.pathname, id });
  const setMobileOpen = (open: boolean) =>
    setSheetState({ path: location.pathname, open });

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(closeAllMenus, 160);
  };

  const openMenu = (id: string) => {
    cancelClose();
    setFocusOnOpen(false);
    setOpenId(id);
  };

  const toggleMenu = (id: string, keyboard: boolean) => {
    cancelClose();
    setFocusOnOpen(keyboard);
    setOpenId(openId === id ? null : id);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openId) return;
    const openSectionId = openId;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllMenus();
        triggerRefs.current[openSectionId]?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeAllMenus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId]);

  useEffect(() => () => cancelClose(), []);


  const signInHref = `/auth?returnTo=${encodeURIComponent("/dashboard")}`;
  const activeSection = NAV_SECTIONS.find((section) =>
    sectionIsActive(section, location.pathname),
  );

  return (
    <header className="sticky top-0 z-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+1.5rem)] bg-gradient-to-b from-background via-background/85 to-transparent"
      />

      <div
        ref={containerRef}
        className="relative mx-auto max-w-[1240px] px-3 pt-3 sm:px-5 sm:pt-4"
      >
        <div
          className={cn(
            "relative flex items-center justify-between gap-3 rounded-full border border-ink/10 px-3 py-2 backdrop-blur-xl transition-colors duration-300 sm:px-4",
            scrolled ? "bg-background/92" : "bg-background/72",
          )}
        >
          <Brand compact className="pl-1.5 text-ink" />

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            {NAV_SECTIONS.map((section) => {
              const isOpen = openId === section.id;
              const isActive = activeSection?.id === section.id;
              return (
                <button
                  key={section.id}
                  ref={(node) => {
                    triggerRefs.current[section.id] = node;
                  }}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`mega-${section.id}`}
                  aria-haspopup="true"
                  onClick={(event) =>
                    toggleMenu(section.id, event.detail === 0)
                  }
                  onPointerEnter={(event) => {
                    if (
                      event.pointerType === "mouse" &&
                      window.matchMedia("(hover: hover) and (pointer: fine)").matches
                    ) {
                      openMenu(section.id);
                    }
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") scheduleClose();
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.82rem] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background xl:px-3.5",
                    isOpen || isActive
                      ? "bg-primary/10 text-primary"
                      : "text-ink/65 hover:bg-primary/8 hover:text-primary",
                  )}
                >
                  {section.label}
                  <ChevronDown
                    className={cn(
                      "size-3.5 opacity-60 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle className="hidden size-9 border-transparent hover:border-line lg:grid" />

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="hidden rounded-full px-3 py-2 text-[0.82rem] font-medium text-ink/65 transition-colors hover:bg-primary/8 hover:text-primary lg:inline-flex"
              >
                My vault
              </Link>
            ) : (
              <Link
                to={signInHref}
                className="hidden rounded-full px-3 py-2 text-[0.82rem] font-medium text-ink/65 transition-colors hover:bg-primary/8 hover:text-primary lg:inline-flex"
              >
                Sign in
              </Link>
            )}

            <Link
              to="/quote"
              className="group hidden items-center gap-2 rounded-full bg-primary py-2 pl-4 pr-2 text-[0.82rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            >
              Get a quote
              <span className="grid size-6 place-items-center rounded-full bg-primary-foreground/20">
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              to="/quote"
              className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground sm:hidden"
            >
              Quote
            </Link>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileOpen}
                  className="grid size-10 place-items-center rounded-full border border-ink/12 text-ink transition-colors hover:bg-ink/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
                >
                  {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                </button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="w-full max-w-[24rem] gap-0 overflow-y-auto bg-background p-0"
              >
                <SheetHeader className="border-b border-line px-5 pb-4 pt-5 text-left">
                  <SheetTitle className="sr-only">Cosmic Vault navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse cover, how it works, claims and support, and contact options.
                  </SheetDescription>
                  <Brand compact className="text-ink" />
                </SheetHeader>

                <div className="border-b border-line px-5 py-4">
                  <Link
                    to="/quote"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-11 w-full items-center justify-between rounded-full bg-primary pl-5 pr-2 text-sm font-medium text-primary-foreground"
                  >
                    Get a quote
                    <span className="grid size-7 place-items-center rounded-full bg-primary-foreground/20">
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </Link>
                  <Link
                    to={isAuthenticated ? "/dashboard" : signInHref}
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 flex h-11 w-full items-center justify-between rounded-full border border-line px-5 text-sm font-medium text-ink"
                  >
                    {isAuthenticated ? "Open my vault" : "Sign in to your vault"}
                    <ArrowRight className="size-3.5 text-ink/45" />
                  </Link>
                </div>

                <Accordion type="single" collapsible className="px-5">
                  {NAV_SECTIONS.map((section) => (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger className="group min-h-[52px] py-3 text-[0.95rem] font-medium text-ink hover:no-underline">
                        <span className="flex items-center gap-3">
                          <Media
                            image={{
                              ...(section.feature.image ?? IMAGES.workspaces),
                              alt: "",
                            }}
                            className="size-9 shrink-0 rounded-full border border-line"
                            imgClassName="grayscale-[35%] transition-all duration-500 group-hover:grayscale-0"
                          />
                          {section.label}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-5">
                          {section.groups.map((group) => (
                            <div key={group.title}>
                              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.24em] text-ink/55">
                                {group.title}
                              </p>
                              <ul className="mt-1.5">
                                {group.links.map((link) => (
                                  <li key={link.href}>
                                    <Link
                                      to={link.href}
                                      onClick={() => setMobileOpen(false)}
                                      className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 py-2 text-[0.85rem] font-medium text-ink/75 transition-colors hover:bg-primary/[0.06] hover:text-primary"
                                    >
                                      {link.label}
                                      <ArrowUpRight className="size-3.5 shrink-0 text-ink/25" />
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}

                          <Link
                            to={section.href}
                            onClick={() => setMobileOpen(false)}
                            className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-primary"
                          >
                            {section.label} overview
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-5 py-4">
                  <p className="flex items-center gap-2 text-[0.68rem] leading-4 text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-electric" />
                    Insured for the long horizon
                  </p>
                  <ThemeToggle className="size-9" />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <AnimatePresence>
          {NAV_SECTIONS.filter((section) => section.id === openId).map(
            (section) => (
              <MegaPanel
                key={section.id}
                section={section}
                focusOnOpen={focusOnOpen}
                onPointerEnter={cancelClose}
                onPointerLeave={scheduleClose}
                onClose={() => {
                  setOpenId(null);
                  setFocusOnOpen(false);
                }}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
