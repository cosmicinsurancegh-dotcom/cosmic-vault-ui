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

CI also restores Bun's global package cache (`~/.bun/install/cache`), keyed on
`bun.lock` with a prefix restore-key, so an install links the packages from disk
instead of downloading them again - measured on this machine, 12s cold against
0.5s warm for the same 421 packages, at the cost of restoring a ~50 MiB archive.
A changed lockfile still reuses the previous cache through the prefix key.

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
- `bun run test` also runs `tests/singleSignInPage.test.ts`, a structural guard
  over `src/main.tsx` and the sign-in call sites. It fails if a second sign-in
  screen, an extra auth address, an in-app sign-in link that points somewhere
  other than `/auth`, `/login` or `/signup`, or a gate screen in `RequireAuth`
  is ever reintroduced; adding an auth address is then a deliberate edit to
  that test.
- GitHub Actions runs that suite on every push
  ([`unit-tests.yml`](.github/workflows/unit-tests.yml)). It needs no secrets or
  deployment, so a broken guard fails the commit's check rather than waiting to
  be noticed locally. Making the check *required* before a merge is a repository
  setting the workflow cannot declare - [Merging into dev and
  main](#merging-into-dev-and-main) has the steps, and what a required check
  does and does not block. The Convex deploy workflow calls that same
  workflow before it deploys - one
  file defines the steps - and both of its deploy jobs wait on it, so a red
  guard stops a deploy, production included, rather than only showing red on the
  build.
- `bun run test:load` / `bun run test:load:abuse` - k6 load and abuse profiles.
  They are opt-in, require `CONVEX_URL`, and must be pointed at staging; see
  [`loadtest/README.md`](loadtest/README.md).

### Merging into dev and main

The intended flow for these two branches: work happens on a branch, a pull
request targets `dev` or `main`, `Vitest unit suite` has to be green, and the
merge is what lands it. The merge is also what releases it - a merge into `dev`
is the push that triggers `Deploy Convex functions`, and Vercel builds `main`
from its push - while production functions stay a manual dispatch, because a
merge to `main` is still not a release.

GitHub reports the job as the check **`Vitest unit suite`** - read off the check
runs of a pushed commit, not guessed. (`Live site smoke check` and `Supabase
Preview` are the repository's other checks.) The ruleset that requires it is
**active**: `dev-main-gate` (id `25890320`), applied 2026-10-26, with no branch
protection alongside it. `unit-tests.yml` runs on `pull_request` against `dev`
and `main` as well, which is what makes the check requireable at all: a push
covers branches in this repository, but a pull request opened from a fork runs
its push inside the fork and reports nothing here.

Applying or changing it needs a repository **admin**: the API answers `404` for
`/branches/<branch>/protection` and `/rulesets` to a push-only token rather than
explaining itself. The commands below were run from the owner account
(`cosmicinsurancegh-dotcom`, the active account on this machine's CLI); the other
login on this machine, `xkobxx`, has push but not admin and cannot make this
change. Both logins are stored, and the active one is what `gh` and HTTPS
`git push` use - `gh auth switch --user xkobxx` returns to the non-admin account,
`--user cosmicinsurancegh-dotcom` comes back.

The configuration, decided explicitly rather than assumed: `dev` and `main` take
changes only through a **pull request**, that pull request's `Vitest unit suite`
check must pass, **no one may delete either branch**, and there are **no bypass
actors** - nobody, owner included, can update or delete them outside a green
check. That is the strict form on purpose: a bypass list is what would let the
check be sidestepped, so the value of the rule depends on it being empty. The
cost is that the direct push to `dev` and `main` is gone; every change arrives on
a branch and merges through a pull request, which is how the release checklist
below is written.

The deletion rule is not decoration. The repository has _Automatically delete
head branches_ turned on (`delete_branch_on_merge`), which is what keeps merged
feature branches from piling up - but a pull request **from** `dev` into `main`
has `dev` as its head branch, so without the rule the first release pull request
would delete `dev` on merge. GitHub says branch protection rules and repository
rules "can also prevent branches being automatically deleted"
([managing automatic deletion](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)),
and the deletion rule is that protection; a ruleset that merely _targets_ a
branch is not enough. The trade is that `dev` and `main` can no longer be deleted
by anyone, so removing one for good means deleting this rule first (or adding a
bypass actor for that moment).

**In the UI** - this is what `dev-main-gate` is, named the way GitHub names it:
Settings → Rules → Rulesets, target `refs/heads/dev` and `refs/heads/main`, rules
_Require a pull request before merging_, _Require status checks to pass_ and
_Restrict deletions_, `Vitest unit suite` as the required check, Enforcement
_Active_, bypass list empty. The approving-review count is zero: with two
accounts, requiring a review would mean a second account has to approve every
pull request, and the check is the gate wanted here.

**To recreate or replace it** (the endpoint needs _Administration: write_):

```bash
gh api --method POST repos/cosmicinsurancegh-dotcom/cosmic-vault-ui/rulesets --input - <<'JSON'
{
  "name": "dev-main-gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/dev", "refs/heads/main"], "exclude": [] }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["merge", "squash", "rebase"],
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_approving_review_count": 0,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Vitest unit suite", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
```

This body created the live ruleset: the same body extracted from this file was
piped into `gh api` and returned id `25890320`. Four details are worth keeping:

- It omits `bypass_actors` entirely. That field being absent is what makes the
  rules universal, and adding an entry to it is the only way to loosen them.
- The deletion rule is the one that stops _Automatically delete head branches_
  from removing `dev` when a release pull request is merged into `main`. Bare
  `{ "type": "deletion" }` takes no parameters; it was added to this ruleset
  after the automatic deletion was turned on, which is when the hazard appeared.
- `conditions.ref_name` needs `"exclude": []` even though every branch is
  included. Without it the create call fails `422` with a message naming the
  missing parameter (`exclude`); that is exactly how the first attempt failed
  here.
- `integration_id: 15368` is the GitHub Actions app, so only a check reported by
  Actions satisfies the rule.

GitHub stores more than the body sent: the live rules came back with
`require_extra_approval_for_unattributed_changes: true` and
`do_not_enforce_on_create: false` added to the parameters. Neither changes the
gate as configured. The first only adds an approval when the configured count is
already above zero; the [available
rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
says it has "no effect if the ruleset requires zero approvals". The second is
the documented default, and it is the one to know about if `dev` or `main` ever
has to be recreated: the [REST
reference](https://docs.github.com/en/rest/repos/rules) defines it as "Allow
repositories and branches to be created if a check would otherwise prohibit
it", so at `false` the check applies to a matching branch at creation, not only
when one is updated.

Verify it, from any account - three rules on each branch, and automatic deletion
on:

```bash
gh api repos/cosmicinsurancegh-dotcom/cosmic-vault-ui/rules/branches/dev \
  --jq '[.[] | .type] | sort | join(", ")'
# -> deletion, pull_request, required_status_checks

gh api repos/cosmicinsurancegh-dotcom/cosmic-vault-ui \
  --jq '"delete_branch_on_merge=\(.delete_branch_on_merge)"'
# -> delete_branch_on_merge=true
```

Three things decide whether this does what you want:

- With these rules active and no bypass, a direct push to either branch is
  refused for every account: a ruleset does not exempt the owner unless a bypass
  entry says so. A pull request is the only way in. If a direct push is ever
  needed again, that is what `bypass_actors` is for - one entry restores it for
  that actor alone, at the cost of the check no longer being absolute for them.
  `.githooks/pre-push` warns before such a push leaves the machine: it names the
  protected branch, the commit at its head and the `GH013` refusal to expect.
  This notice stays a warning - unlike the author check in the same hook, which
  does refuse the push - because the outcome is not locally knowable: the check
  rule on its own accepts a push whose commits already passed the check on
  another ref, and the `pull_request` rule alongside it is what requires the
  branch to move through a merge.
- A required check gates an **update of the branch**, not the commit that first
  introduces the problem: GitHub's own wording is that commits "must first be
  pushed to another ref where the checks pass", and a push of a commit without
  them is rejected (`GH013`, "... is expected"). This is why the check has to run
  on `pull_request`: on a branch in this repository the push already reports it,
  but a pull request from a fork only reports through that trigger.
- Who the merge commit ends up authored by decides whether Vercel will build it,
  because that is the only author its Hobby project accepts (see above), and the
  hook cannot check it (see [Which commits Vercel will build](#which-commits-vercel-will-build)).
  GitHub does not hand the authorship to whoever clicks merge - reports differ on
  whether a squash merge carries the pull request's author or the merger's. Both
  merges recorded here had the same account as author and merger, and came out
  authored by that account, so the case that would tell them apart is still
  untested. If a
  merged pull request lands a commit authored by another account, the release
  check says so in Vercel's own words rather than failing quietly, so merge the
  first pull request and read `bun run deploy:status` (the `Smoke the live site`
  workflow already does) before assuming the branch reached production.

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
  `target: dev`. In the pull-request flow described under
  [Merging into dev and main](#merging-into-dev-and-main), a merge is that push.
  Authenticated by the `CONVEX_DEPLOY_KEY_DEV` secret. A `Vitest unit suite` job
  runs first and both deploy jobs need it, so a failing test - the sign-in guard
  included - stops the deploy instead of shipping functions alongside a red
  check, dev and production alike.
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

The push itself still succeeds and only the deployment is blocked, which is what
makes it easy to miss - so a commit that would not build is not pushable from
here. `.githooks/pre-push` reads the author of every commit a push would send and
**refuses the push** (non-zero exit) when any of them is an address other than
the owner's, naming each one. `bun install` installs the hook by pointing
`core.hooksPath` at `.githooks`; if a fresh clone does not fire it, run
`git config core.hooksPath .githooks` once. This checkout commits as that account
(`user.email` is the owner's GitHub noreply address, whose numeric id is the
account's). The check tests that one field and nothing else, so it is not a
judgement about the change: to let another author through, add the address to the
list it tests (`git config --local --add vercel.projectOwnerEmail <email>`), and
`git push --no-verify` skips it entirely - which the first push of an existing
history to a new remote needs, since every commit in it is new there. The one
commit the hook cannot see is a pull request's own merge commit, which GitHub
authors server-side with no client hook in the path; that is the case the bullet
above about the merge author covers.

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

Every job that installs uses `bun install --frozen-lockfile`, so `bun.lock`
must be current before a deploy.

### Release checklist

1. Open a pull request into `dev` and let `Vitest unit suite` pass; merging it
   is what pushes to `dev` and starts the deploy job. A dispatch with
   `target: dev` re-runs the deploy on its own when there is nothing to merge.
2. Get the release commit onto `main` the same way - through a pull request
   whose check is green - then from `main` run the workflow with `target: prod`
   and `confirm: deploy-prod`.
3. Check the run: `Vitest unit suite`, `Check production confirmation` and
   `Deploy functions` must all be green. A dispatch without the phrase fails
   there by design, and a red suite skips `Deploy functions` rather than
   releasing to production.
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

`/dashboard` is protected with `RequireAuth`. Extend that page for the product's
authenticated experience, and reuse `RequireAuth` when adding another protected
route - do NOT hand-roll a redirect to `/auth`.

There is exactly one sign-in page: `/auth`. A signed-out visitor who opens a
protected route is sent there with `returnTo=<current route>`, and lands back on
the page they asked for once they are signed in. No second gate screen is
rendered on the way through, so a link from an email behaves the same as the
navbar's sign-in link.

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  }
/>
```

`/login` and `/signup` are addresses for that same page, not separate screens:
both redirect to `/auth`, and `/signup` selects the create-account tab. The tab
(`mode=signin|signup`) and the sign-in method (`method=code|password`) both live
in the URL, so a reload, a bookmark or a shared link opens the same state, with
`returnTo` carried through.

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
