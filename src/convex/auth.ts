// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import {
  emailOtp,
  passwordResetEmail,
  passwordVerifyEmail,
} from "./auth/emailOtp";

// Email + password sign-in sits beside the passwordless email code. A new
// password account only becomes usable after its email address is confirmed
// with a six-digit code, which also links it to an existing email-code user
// with the same address instead of creating a duplicate profile.
const password = Password({
  verify: passwordVerifyEmail,
  reset: passwordResetEmail,
  // Emails are stored and matched lower-case so password accounts line up with
  // the address the user signed in with, whatever casing they typed.
  profile(params) {
    const email =
      typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
    if (!email) {
      throw new Error("An email address is required.");
    }
    return { email };
  },
  validatePasswordRequirements(value) {
    if (typeof value !== "string" || value.length < 8) {
      throw new Error("Use at least 8 characters for your password.");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, password, Anonymous],
});
