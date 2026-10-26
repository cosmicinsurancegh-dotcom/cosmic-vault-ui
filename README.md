## Overview

This project uses the following tech stack:

- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Supabase (for Postgres, Storage and Realtime as a second data plane)
  - `@supabase/supabase-js` v2 - browser client in `src/lib/supabase.ts` (anon key, no session store)
  - Server-side access only through the `"use node"` Convex actions in `src/convex/supabase.ts` (service role key)
  - Identity stays with Convex Auth; Supabase is not a second login provider
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

### Insurance platform

This deployment runs the Cosmic Vault insurance management platform on top of the
template: customer, broker and staff dashboards, manual underwriting, policy
issuance, claims, payments, documents, notifications, reports and audit logging.
Architecture, permission model, workflows, environment variables, verification
results and known limitations are documented in [`docs/PLATFORM.md`](docs/PLATFORM.md).

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

### Dependencies

Bun is the only package manager and `bun.lock` the only lockfile. CI, Vercel
(`vercel.json`) and every script use it, so run `bun install` - or
`bun install --frozen-lockfile` to match CI exactly - and never `npm install`.

The `packageManager` field pins the Bun version CI downloads, so both sides
resolve the same graph; npm, yarn and pnpm lockfiles are ignored so a stray
install cannot commit a second one. If you edit `package.json`, re-run
`bun install` in the same commit, otherwise CI's frozen install fails.

The `overrides` pin on `@jridgewell/sourcemap-codec` is load-bearing: Bun hoists
that package where npm used to nest it, and without the pin Vitest's nested
`magic-string` resolves a copy too old to start the runner.

## Testing

- `bun run test` - Vitest unit tests for the Convex functions (`tests/*.test.ts`).
- `bun run test:e2e` - Playwright browser suite (`tests/e2e`). It starts Vite on
  port 4174 with `tests/e2e/vite.e2e.config.ts`, which aliases `convex/react`,
  `@convex-dev/auth/react` and the generated api to the doubles in
  `tests/e2e/stubs`, so no deployment, credentials or network are needed. The
  suite clicks every mega-menu link, every footer link, and drives the sign-in
  redirect flow (protected link → `/auth?returnTo=…` → destination).
- `bun run test:e2e:types` - type-checks the browser suite and its stubs.
- `bun run test` also runs `tests/security.test.ts`, which covers server-side
  authorisation, the public lead form's validation and rate limits, the
  founding-admin check, and cross-member transaction references.
- `bun run test:load` / `bun run test:load:abuse` - k6 load and abuse profiles.
  They are opt-in, require `CONVEX_URL`, and must be pointed at staging; see
  [`loadtest/README.md`](loadtest/README.md).

Production-readiness findings, the capacity assessment, operational runbook
and outstanding risks are in
[`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md).

Install the browser once with `bunx playwright install chromium` if it is not
already present on the machine.

## Deployment

Two Convex deployments: `descriptive-ferret-801` (production, what the live
site talks to) and `avid-camel-675` (development). Functions are published by
the `Deploy Convex functions` workflow, so no one needs a local Convex login
to ship the backend.

- **Dev functions** - push to `dev`, or run the workflow manually with
  `target: dev`. Authenticated by the `CONVEX_DEPLOY_KEY_DEV` secret.
- **Production functions** - manual run only, from `main`, with `target: prod`
  and `confirm: deploy-prod`. A merge to `main` is not a release. Authenticated
  by the `CONVEX_DEPLOY_KEY_PROD` secret, held on the `convex-prod`
  environment.
- **Frontend** - Vercel builds `main` on push. The browser's Convex URL is
  `DEFAULT_CONVEX_URL` in `src/lib/convexUrl.ts` (production) unless the Vercel
  project sets a `VITE_CONVEX_URL` that really is a Convex deployment. A value
  that is not - the site's own origin, say - is swapped for `DEFAULT_CONVEX_URL`
  during the build with a warning in the build log, so the published bundle can
  reach a backend instead of rendering the configuration screen.

### Which commits Vercel will build

Vercel only builds a commit whose *author* is the owner of the Vercel project.
That is the `cosmicinsurancegh-dotcom` account, and the Hobby plan has a single
member, so a commit authored by anyone else is refused before the build starts:

> Git author `<login>` must have access to the project on Vercel to create
> deployments.

The push itself still succeeds and only the deployment is blocked, which is easy
to miss. `.githooks/pre-push` warns about it before the push lands, listing each
commit whose author would block the build. `bun install` installs the hook by
pointing `core.hooksPath` at `.githooks`; if a fresh clone does not fire it, run
`git config core.hooksPath .githooks` once. This checkout commits as that
account (`user.email` is the owner's GitHub noreply address). To accept a
different author, `git config --local --add vercel.projectOwnerEmail <email>`;
`git push --no-verify` skips the warning.

The dashboard checks the deployment on load, independently of the Convex
client: it fetches the public `setup:health` over the Convex HTTP API and, when
the probe fails or the deployment is paused, shows a banner above the dashboard
naming the cause with a _Check again_ button. The probe is argument-free and
needs no session, because production redacts every failure to a bare
`Server Error` - probing a signed-in query would make a healthy deployment
answer exactly like one that runs nothing. A failed probe is retried before it
is reported, and a failing tab re-checks when it becomes visible again.

`bun run smoke:live` checks the published site after a release: that the served
bundle targets `DEFAULT_CONVEX_URL`, that `setup:health` answers, that a missing
`/assets/*` file is a `404` rather than `index.html`, and that `/dashboard` still
serves the app. The `Smoke the live site` workflow runs it on every push to
`main`, every six hours, and on demand; set `SMOKE_WAIT_SECONDS` to let it wait
for a deploy to land, and `SMOKE_BASE_URL` to check another origin. That origin
must apply `vercel.json`'s rewrites - a plain static server answers a missing
asset with `index.html` and fails that check by design.

`bun run deploy:status` checks the other half: that Vercel actually built the
commit being released. It reads the commit's `Vercel - ...` status, waiting up to
`VERCEL_WAIT_SECONDS` for it to finish, and fails when the build was blocked,
cancelled or never started, writing the reason - including Vercel's own wording -
to the run summary. The `Smoke the live site` workflow runs it before the smoke
check, so a release whose deployment never happened fails instead of passing
against the previous deployment. `GITHUB_REPOSITORY` and `GITHUB_SHA` select the
commit; `GITHUB_TOKEN` is optional for a public repository.

Routes are code-split, so a tab left open across a deploy asks for a chunk the
new build replaced. Missing `/assets/*` files are kept out of the SPA rewrite,
so they fail as `404` rather than returning `index.html` (a `.js` URL answering
`text/html`, cached as immutable, is what produced the browser's "not a valid
JavaScript MIME type" error), and the app reloads once when Vite reports a
preload error.

Both jobs install with `bun install --frozen-lockfile`, so `bun.lock` must be
current before a deploy.

### Release checklist

1. Land the backend change on `dev` (push or dispatch `target: dev`) and let
   the dev job pass.
2. From `main`, run the workflow with `target: prod` and
   `confirm: deploy-prod`.
3. Check the run: `Check production confirmation` and `Deploy functions` must
   both be green. A dispatch without the phrase fails there by design.
4. Confirm production is serving the code you pushed, not just answering.
   List what is deployed and grep for a function this release added or renamed:
   `bunx convex function-spec --prod | grep -q 'setup.js:seedDeployment' && echo live`.
   Then execute against the deployment, which proves the runtime works and not
   only that a host replies:
   `bunx convex run --prod --inline-query 'return (await ctx.db.query("products").take(1)).length'`.
   Do not use `/version` for this - it reports the Convex backend build, which
   does not change when your functions do.
5. Open the live site and sign in once - a green deploy only proves the
   functions uploaded, not that the client resolves them.

A fresh deployment has no accounts, so seed it before its first sign-in:
`bunx convex run setup:seedDeployment --prod` creates the reference data and
starter catalogue. Reviewer approval on the `convex-prod` environment needs a
paid plan for private repos; until then the typed confirmation is the gate.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

`VITE_CONVEX_URL` is validated in `src/lib/convexUrl.ts`: a missing value
resolves to the production deployment (`DEFAULT_CONVEX_URL`), while a value that
is not a Convex deployment URL renders the configuration screen. It is never
silently swapped for another host, because guessing hides the mistake - the
client then queries a deployment that serves no functions and every screen
fails with an opaque "Server Error". Sign-in requests also have a 15 second
deadline (`src/lib/signInTimeout.ts`), so an unreachable deployment shows an
error rather than a button stuck on "Sending code".

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.

Supabase is wired as a second data plane (Postgres, Storage, Realtime) alongside
Convex, which stays the app's primary backend and identity provider. Add these in
the project Keys tab (Supabase dashboard → Project Settings → API):

- `VITE_SUPABASE_URL` - project URL, read by the browser client in `src/lib/supabase.ts`.
- `VITE_SUPABASE_ANON_KEY` - anon/public key, browser only, protected by row-level security.
- `SUPABASE_SERVICE_ROLE_KEY` - service role key, used only inside the Convex
  Node actions in `src/convex/supabase.ts`. Never expose it to the browser.

Sign in as staff (`settings.manage`) and open **Dashboard → Settings → Supabase**
to see which keys each runtime can see and to test the connection.

# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:

```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route - do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.

- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.

## Landing Pages

You must always create good-looking designer-level styles to your application.

- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.

### Other Items to animate

- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.

## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead.

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.

## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```

## Common Convex Mistakes To Avoid

When using convex, make sure:

- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.
