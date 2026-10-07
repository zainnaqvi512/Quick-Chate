import crypto from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { sessions, users, type User } from "../db/schema";
import { publicQuery } from "./middleware";

// OTP development secret is random per process, never a predictable production fallback.
const SECRET =
  process.env.APP_SECRET ||
  process.env.JWT_SECRET ||
  crypto.randomBytes(32).toString("hex");
export function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  void _passwordHash;
  return safe;
}
export function assertOtpDevelopmentEnabled() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.OTP_PROVIDER !== "dev"
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Use verified phone sign-in.",
    });
  }
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashOtp(phone: string, otp: string): string {
  return sha256(`${phone}:${otp}:${SECRET}`);
}

/** Normalize phone to E.164-like: "+" + dial code digits + national digits (leading 0 stripped). */
export function normalizePhone(countryCode: string, national: string): string {
  if (!/^[+\d\s().-]+$/.test(national))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid phone number",
    });
  const raw = national.trim().startsWith("+")
    ? national.trim()
    : `${countryCode}${national}`;
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed?.isPossible())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid phone number length",
    });
  return parsed.number;
}

export function generateOtp(): string {
  // Fixed test OTP when explicitly configured (development only)
  if (process.env.NODE_ENV !== "production" && process.env.TEST_OTP)
    return process.env.TEST_OTP;
  return String(crypto.randomInt(100000, 999999));
}

export async function createSession(userId: number, userAgent?: string) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      userAgent: userAgent?.slice(0, 250),
      expiresAt,
    });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

const lastSeenWriteCache = new Map<number, number>();

export async function getUserFromRequest(
  req: Request
): Promise<{ user: ReturnType<typeof safeUser>; token: string } | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const db = getDb();
  const tokenHash = sha256(token);
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()))
    )
    .limit(1);
  const session = rows[0];
  if (!session) return null;
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return null;
  // Throttled last-seen / presence update (server authoritative)
  const last = lastSeenWriteCache.get(user.id) || 0;
  if (Date.now() - last > 20_000) {
    lastSeenWriteCache.set(user.id, Date.now());
    db.update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, user.id))
      .catch(() => {});
  }
  return { user: safeUser(user), token };
}

/** Authenticated procedure: requires `Authorization: Bearer <token>`. */
export const sessionQuery = publicQuery.use(async ({ ctx, next }) => {
  const result = await getUserFromRequest(ctx.req);
  if (!result)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  return next({
    ctx: { ...ctx, user: result.user, sessionToken: result.token },
  });
});

export const authedQuery = sessionQuery.use(({ ctx, next }) => {
  if (!ctx.user.phone)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Verify your phone number before using Quick Chat.",
    });
  return next({ ctx });
});
