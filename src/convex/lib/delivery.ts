/**
 * What the email gateway actually said about a message.
 *
 * `@vly-ai/integrations` reports transport success, not delivery: `send()`
 * resolves with `{ success: true }` for any HTTP 2xx, and the gateway's own
 * verdict arrives in the body as `data.status` (`"sent"`, `"queued"` or
 * `"failed"`) with an optional `data.error`. Reading only `success` therefore
 * records a refused message as delivered, which is how a customer can go
 * without an email while the console shows "sent" and nothing else to retry.
 *
 * Kept free of imports so it can be unit-tested and used from the Node actions
 * that send mail.
 */

/** The part of the client's `ApiResponse<EmailResponse>` this decides on. */
export type EmailSendResult = {
  success: boolean;
  error?: string;
  data?: {
    status?: string;
    /** The gateway's reason, e.g. an `Invalid \`to\` field` rejection. */
    error?: string;
  };
};

const FALLBACK_FAILURE = "Provider rejected the message.";

/**
 * Why the message was not accepted, or `null` when the gateway took it.
 *
 * A 2xx whose body says `failed` is a failure, and the reason the provider gave
 * is carried through so it can be stored and shown to staff. A 2xx with no
 * status in the body is left as accepted: the transport succeeded and there is
 * no verdict to contradict it.
 */
export function deliveryFailure(result: EmailSendResult): string | null {
  if (!result.success) {
    return result.error?.trim() || FALLBACK_FAILURE;
  }

  if (result.data?.status === "failed") {
    return (
      result.data.error?.trim() ||
      result.error?.trim() ||
      FALLBACK_FAILURE
    );
  }

  return null;
}
