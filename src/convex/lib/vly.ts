// Convex-side binding for the platform integration gateway. Kept inside the
// convex folder so the Convex bundler can resolve it (it cannot import from
// the Vite `src/lib` tree).
import { createVlyIntegrations } from "@vly-ai/integrations";

export const vly = createVlyIntegrations({
  deploymentToken: process.env.VLY_INTEGRATION_KEY!,
  debug: process.env.NODE_ENV === "development",
});

// The gateway's default sender shows its generated mailbox name (e.g.
// "silent-planets-accept") as the display name. The address the gateway sends
// from (the part inside the <> in a received email's From header) is set in
// Settings, falling back to EMAIL_FROM_ADDRESS on the deployment and then to
// the gateway's own authenticated sender; see `./sender` for how the header is
// built.
