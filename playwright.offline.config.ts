/**
 * Temporary: runs the normal suite with every non-loopback hostname
 * unresolvable, to prove the browser tests need no internet.
 */
import base from "./playwright.config";

export default {
  ...base,
  projects: (base.projects ?? []).map((project) => ({
    ...project,
    use: {
      ...project.use,
      launchOptions: {
        args: [
          "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
        ],
      },
    },
  })),
};
