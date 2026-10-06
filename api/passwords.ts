import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$32768$8$1$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts.slice(0, 4).join("$") !== "scrypt$32768$8$1" ||
      !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const actual = await derive(password, parts[4]);
  return timingSafeEqual(actual, Buffer.from(parts[5], "hex"));
}
// Unknown accounts still incur the same password work as existing accounts.
export const DUMMY_PASSWORD_HASH = `scrypt$32768$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
