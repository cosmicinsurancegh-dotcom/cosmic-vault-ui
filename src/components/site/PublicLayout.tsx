import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";

/**
 * Shell for every public marketing, guidance, claims and legal page.
 * The authenticated application deliberately uses its own layout.
 */
export function PublicLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[4px] focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {/* The landing hero runs to the top of the page, so the bar floats over it. */}
      <Navbar overlay={pathname === "/"} />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
