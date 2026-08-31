/**
 * Where this app actually lives.
 *
 * It used to be `toko.app` everywhere — a domain that has never existed. The
 * share card printed it, the share text linked to it, and the OG metadata
 * pointed at it, so the one thing a player was meant to send someone was a dead
 * link. There is no deployment yet, so the honest default is the local one and
 * the real value comes from the environment when there is one.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** The bare host, for printing on the share card. */
export const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, "");
