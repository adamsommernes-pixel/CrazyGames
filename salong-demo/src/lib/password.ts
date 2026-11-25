/**
 * Demo-only password check. The hash is compared in the browser, which keeps
 * honest people out of the admin in a demo but is not access control: anyone
 * with dev tools can get past it. Production replaces this with server-side auth.
 */
const SALT = "salong-admin:";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + password);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PASSWORD_MIN_LENGTH = 8;
