import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * There is one sign-in screen in this app, and this is what keeps it that way.
 *
 * The product used to ship two: the branded page at `/auth` (also mounted at
 * `/login` and `/signup`) and a separate "Sign in to your insurance workspace"
 * card drawn by `RequireAuth`. A link from a shipment email opened the card and
 * the navbar's sign-in link opened the page, so the same account looked like two
 * different products. Every signed-out entry point now lands on `/auth`, and the
 * gate redirects instead of drawing a screen.
 *
 * These checks read the router and the sign-in call sites rather than rendering
 * a browser, so a new auth URL, a stray link or a second form fails here before
 * it can reach a user, whichever route or component it is added to. This is a
 * deliberate tripwire: if another address should genuinely exist, add it to the
 * expectations below so the change is a decision rather than an accident.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The only addresses a sign-in link may use. */
const AUTH_ADDRESSES = ["/auth", "/login", "/signup"];

/** Paths that read as an auth entry point to a visitor or a link. */
const AUTH_PATH = /(auth|log-?in|sign-?in|sign-?up|register)/i;

/** Segments that name a sign-in page, used to read a link's path. */
const AUTH_SEGMENTS = new Set([
  "auth",
  "login",
  "log-in",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "register",
]);

/**
 * A URL-looking token in source: an in-app path or an absolute URL, at the
 * start of a string or after a boundary. Module specifiers such as
 * `@convex-dev/auth/server` are not links and never match, because their auth
 * segment is not at the start of a token.
 */
const LINK_TOKEN = /(?:^|[\s"'`(=,{}>])((?:\/|https?:\/\/)[^\s"'`<>()]*)/g;

const read = (path: string) =>
  readFileSync(join(ROOT, ...path.split("/")), "utf8");

/** Paths are reported POSIX-style so the expectations read the same everywhere. */
const projectPath = (file: string) =>
  relative(ROOT, file).split(sep).join("/");

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/**
 * An auth REST namespace, not a page a visitor signs in on (Supabase Auth).
 * Everything else that carries an auth segment is treated as a sign-in link.
 */
const AUTH_API_PATH = /^\/auth\/v\d+\//i;

/**
 * The path a visitor would land on when `url` names a sign-in page, or `null`.
 *
 * An auth-named segment anywhere in the path decides, so `/signup/verify` and
 * `/member/login` are caught as well as `/signin`. `${url}/auth/v1/health` is
 * an API endpoint rather than a page and is left alone. The trailing slash is
 * dropped so `/auth/` is judged as `/auth`, and the query and hash are ignored.
 */
function signInPathname(url: string): string | null {
  const pathname = url
    .split(/[?#]/)[0]
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/+$/, "");

  if (AUTH_API_PATH.test(pathname)) return null;

  const namesASignInPage = pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => AUTH_SEGMENTS.has(segment.toLowerCase()));

  return namesASignInPage ? pathname : null;
}

/** Every sign-in link in `source` that is not one of the allowed addresses. */
function disallowedAuthLinks(source: string): string[] {
  return [...source.matchAll(LINK_TOKEN)].flatMap((match) => {
    const url = match[1] ?? "";
    const pathname = signInPathname(url);
    return pathname && !AUTH_ADDRESSES.includes(pathname) ? [url] : [];
  });
}

/**
 * The self-closing `<Route … />` tags in a router source.
 *
 * A route's `element={…}` holds JSX that can itself end in `/>`, so the tag
 * cannot be found with a plain regex. This walks each tag and only treats `/>`
 * as the end of it when no `{` is open; a `>` at depth zero is a route with
 * children, whose own child routes are found on the following passes.
 */
function selfClosingRoutes(source: string) {
  const tags: string[] = [];
  const marker = "<Route";

  let index = source.indexOf(marker);
  while (index !== -1) {
    let braces = 0;
    let cursor = index + marker.length;

    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "{") {
        braces += 1;
      } else if (char === "}") {
        braces -= 1;
      } else if (braces === 0 && char === "/" && source[cursor + 1] === ">") {
        tags.push(source.slice(index, cursor + 2));
        cursor += 1;
        break;
      } else if (braces === 0 && char === ">") {
        break;
      }
    }

    index = source.indexOf(marker, cursor + 1);
  }

  return tags.map((tag) => ({
    path: tag.match(/path="([^"]+)"/)?.[1] ?? "",
    element: tag.match(/element=\{([\s\S]*)\}/)?.[1]?.trim() ?? "",
  }));
}

describe("the one sign-in page", () => {
  const router = read("src/main.tsx");
  const routes = selfClosingRoutes(router);
  const pageRoutes = routes.filter((route) => route.element.includes("<AuthPage"));
  const aliasRoutes = routes.filter((route) =>
    route.element.includes("<AuthAlias"),
  );

  it("renders the sign-in page at /auth and at no other address", () => {
    expect(
      pageRoutes.map((route) => route.path),
      "a second route mounts AuthPage; /login and /signup must redirect to /auth instead",
    ).toEqual(["/auth"]);
  });

  it("sends /login and /signup to /auth rather than mounting another copy", () => {
    const addresses = Object.fromEntries(
      aliasRoutes.map((route) => [
        route.path,
        route.element.match(/mode="([^"]+)"/)?.[1] ?? "",
      ]),
    );

    expect(
      addresses,
      "the only auth addresses besides /auth are the two redirects to it",
    ).toEqual({ "/login": "signin", "/signup": "signup" });

    // The alias must be a redirect onto /auth, not a component that draws a page.
    expect(
      router,
      "AuthAlias should navigate to /auth carrying its mode and returnTo",
    ).toMatch(/function AuthAlias[\s\S]{0,400}?<Navigate to=\{`\/auth\?/);
  });

  it("exposes no auth address beyond /auth and its two aliases", () => {
    const addresses = routes
      .map((route) => route.path)
      .filter((path) => path && AUTH_PATH.test(path))
      .sort();

    expect(
      addresses,
      "a new auth-sounding route was added; it must redirect to /auth or be removed",
    ).toEqual(AUTH_ADDRESSES);
  });

  it("points every in-app sign-in link at /auth or one of its aliases", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .filter((file) => !file.includes("_generated"))
      .flatMap((file) =>
        disallowedAuthLinks(readFileSync(file, "utf8")).map(
          (link) => `${projectPath(file)} -> ${link}`,
        ),
      );

    expect(
      offenders,
      "a sign-in link must point at /auth, /login or /signup so it opens the one sign-in page",
    ).toEqual([]);
  });

  it("starts a sign-in from one module only", () => {
    const callers = sourceFiles(join(ROOT, "src"))
      .filter((file) => !file.includes("_generated"))
      .filter((file) => /\bsignIn\s*\(/.test(readFileSync(file, "utf8")))
      .map(projectPath)
      .sort();

    expect(
      callers,
      "a new sign-in form must live on the /auth page, not in a second screen",
    ).toEqual(["src/pages/Auth.tsx"]);
  });

  it("keeps the protected-route gate a redirect, not a sign-in screen", () => {
    const gate = read("src/components/RequireAuth.tsx");

    expect(
      gate,
      "RequireAuth must send visitors to /auth with the page they asked for",
    ).toMatch(/<Navigate to=\{`\/auth\?returnTo=/);

    expect(
      gate,
      "RequireAuth must not draw its own sign-in UI (headline, form, fields or buttons)",
    ).not.toMatch(/<h1|<form|<input|<Button/);
  });
});
