/**
 * Who outbound email comes from.
 *
 * The address is set in Settings so an admin can change it without a
 * deployment, and the display name is the company name they configured. A
 * deployment that has not set one keeps using EMAIL_FROM_ADDRESS, which is how
 * the sender was configured before the setting existed, and finally the
 * gateway's own authenticated sender.
 *
 * Kept free of imports so it can be unit-tested and used from the Node actions
 * that send mail.
 */

/** The brand name used when no company name has been configured. */
export const FALLBACK_FROM_NAME = "Cosmic Vault Insurance";

/**
 * The address used when neither Settings nor the deployment names one.
 *
 * Leaving `from` out is not neutral: `@vly-ai/integrations` substitutes its own
 * single-send default, `noreply@project.freebuff.dev`. That domain publishes no
 * SPF, DKIM or DMARC record, so a receiving provider cannot authenticate the
 * message and quietly discards it - while the gateway still answers HTTP 200,
 * so the delivery action records "sent" and nothing ever reaches the customer.
 * `freebuff.com` is the sender the same client uses for batch sends: the
 * gateway authenticates it, so a message sent under the company name is
 * delivered instead of binned, and the From line no longer reads as the
 * gateway's generated mailbox.
 */
export const GATEWAY_FROM_ADDRESS = "noreply@freebuff.com";

/**
 * The bare address to send from: the configured one, else the deployment's,
 * else the gateway's authenticated sender. Never empty, so a message always
 * carries an address the receiving side can check.
 */
export function senderAddress(configured?: string): string {
  return (
    configured?.trim() ||
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    GATEWAY_FROM_ADDRESS
  );
}

/**
 * The `from` header, e.g. `Cosmic Vault Insurance <mail@cosmicvault.co>`. The
 * company name is always stamped, so the recipient sees the business rather
 * than whichever mailbox the gateway happens to send from.
 */
export function emailSender({
  emailFromAddress,
  companyName,
}: {
  /** The address saved in Settings; blank means the deployment's. */
  emailFromAddress?: string;
  /** The company name the messages are sent under. */
  companyName?: string;
} = {}): string {
  return `${companyName?.trim() || FALLBACK_FROM_NAME} <${senderAddress(
    emailFromAddress,
  )}>`;
}
