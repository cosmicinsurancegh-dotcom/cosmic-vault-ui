import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Every sign-in code this app sends is a six-digit one-time token delivered by
 * the Freebuff integrations gateway. The same delivery path backs the
 * passwordless email code, the password sign-up verification code and the
 * password reset code, so they all look and behave the same to the recipient.
 */
const codeSettings = {
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({
    identifier: email,
    token,
  }: {
    identifier: string;
    token: string;
  }) {
    try {
      // The gateway is an external dependency inside the sign-in mutation:
      // without a timeout a stalled call would hold the request until the
      // platform kills it. Fail fast and let the user retry instead.
      await axios.post(
        freebuffEmailOtpUrl(),
        { to: email, otp: token },
        {
          headers: freebuffEmailOtpHeaders(),
          timeout: 10_000,
          maxRedirects: 0,
        },
      );
    } catch (error) {
      throw freebuffEmailOtpError(error);
    }
  },
};

// Passwordless sign-in: email address in, six-digit code back.
export const emailOtp = Email({
  id: "email-otp",
  ...codeSettings,
});

// Confirms an email address before a password can be used to sign in, and
// links the new password to an existing email-code account with the same
// address.
export const passwordVerifyEmail = Email({
  id: "password-verify",
  ...codeSettings,
});

// Confirms ownership of the email before a password is replaced.
export const passwordResetEmail = Email({
  id: "password-reset",
  ...codeSettings,
});

// Sign-in codes are sent by the Freebuff integrations gateway, which knows
// this project by its own key: VLY_INTEGRATION_KEY, a Convex environment
// variable set when the project was created. The email's wording is fixed by
// the gateway.
function freebuffEmailOtpUrl(): string {
  const base =
    process.env.VLY_INTEGRATION_BASE_URL || "https://integrations.vly.ai";
  return `${base.replace(/\/+$/, "")}/v1/email/otp`;
}

function freebuffEmailOtpHeaders(): Record<string, string> {
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "VLY_INTEGRATION_KEY is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return { Authorization: `Bearer ${key}` };
}

// Never stringify the whole request error: it carries the request headers.
function freebuffEmailOtpError(error: unknown): Error {
  const response = (
    error as { response?: { status?: number; data?: { error?: unknown } } }
  )?.response;
  if (response) {
    const detail =
      typeof response.data?.error === "string" ? `: ${response.data.error}` : "";
    return new Error(
      `Could not send the sign-in code (HTTP ${response.status})${detail}`,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not send the sign-in code: ${message}`);
}
