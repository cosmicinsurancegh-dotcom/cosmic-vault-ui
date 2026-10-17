// Convex-side binding for the platform integration gateway. Kept inside the
// convex folder so the Convex bundler can resolve it (it cannot import from
// the Vite `src/lib` tree).
import { createVlyIntegrations } from "@vly-ai/integrations";

export const vly = createVlyIntegrations({
  deploymentToken: process.env.VLY_INTEGRATION_KEY!,
  debug: process.env.NODE_ENV === "development",
});
