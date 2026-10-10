/**
 * Share-password hashing, usable in the browser (upload) and on the server (verify).
 *
 * Current format: `pbkdf2$<iterations>$<salt hex>$<hash hex>` (PBKDF2-HMAC-SHA256, random
 * 16-byte salt per password). Iterations are read back from the stored string so the cost can be
 * raised later without breaking existing shares. 100k is the ceiling on Cloudflare Workers.
 *
 * Legacy format: bare 64-char SHA-256 hex with a fixed salt. Still verified so existing shares keep
 * working; use `needsRehash` to upgrade them after a successful check.
 */

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const LEGACY_SALT = "intellitrap-salt-2024";

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Constant-time string comparison, so hash checks do not leak timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(value: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BITS,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashSharePasswordV2(value: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(value, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function legacySha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${value}${LEGACY_SALT}`),
  );
  return toHex(new Uint8Array(digest));
}

export async function verifySharePassword(value: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("pbkdf2$")) return constantTimeEqual(await legacySha256(value), stored);
  const [, iterText, saltHex, hashHex] = stored.split("$");
  const iterations = Number(iterText);
  if (
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 1_000_000 ||
    !saltHex ||
    !hashHex ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    saltHex.length % 2 !== 0
  )
    return false;
  const actual = await pbkdf2(value, fromHex(saltHex), iterations);
  return constantTimeEqual(actual, hashHex.toLowerCase());
}

export function needsRehash(stored: string): boolean {
  if (!stored.startsWith("pbkdf2$")) return true;
  return Number(stored.split("$")[1]) < PBKDF2_ITERATIONS;
}
