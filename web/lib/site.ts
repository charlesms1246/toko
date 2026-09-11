/**
 * Where this app actually lives.
 *
 * It used to be `toko.app` everywhere — a domain that has never existed. The
 * share card printed it, the share text linked to it, and the OG metadata
 * pointed at it, so the one thing a player was meant to send someone was a dead
 * link.
 *
 * It is deployed now, at `toko-pm.vercel.app`, and the share link is the whole
 * point of the referral and duel screens — so getting this wrong ships a dead
 * link again, just a different one.
 *
 * Three sources, in the order you actually want them:
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — the stable alias. **Set this on the deployment.**
 * 2. `NEXT_PUBLIC_VERCEL_URL` — the per-deployment host Vercel injects. A
 *    preview build then links to itself rather than to localhost, which is
 *    wrong but reachable; without it a preview prints a link to the reader's own
 *    machine.
 * 3. localhost, for development.
 */
const VERCEL_HOST = process.env.NEXT_PUBLIC_VERCEL_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (VERCEL_HOST ? `https://${VERCEL_HOST}` : "http://localhost:3000");

/** The bare host, for printing on the share card. */
export const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, "");
