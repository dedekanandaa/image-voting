// Web Crypto API (works in Node.js 15+ and Edge runtime)
// ponytail: PBKDF2-SHA256 slower than scrypt but compatible with Edge. Upgrade to argon2 in separate
// process (not imported by auth.ts) if performance matters.

const ITERATIONS = 100_000;
const ALGORITHM = { name: "PBKDF2", hash: "SHA-256" };

async function importKey(password: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), ALGORITHM, false, ["deriveBits"]);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await importKey(password);
  const hash = await crypto.subtle.deriveBits({ ...ALGORITHM, salt, iterations: ITERATIONS }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, expectedHex] = stored.split(":");
  if (!saltHex || !expectedHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const key = await importKey(password);
  const hash = await crypto.subtle.deriveBits({ ...ALGORITHM, salt, iterations: ITERATIONS }, key, 256);
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === expectedHex;
}
