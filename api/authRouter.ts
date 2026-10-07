import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import {
  authedQuery,
  sessionQuery,
  createSession,
  destroySession,
  generateOtp,
  hashOtp,
  normalizePhone,
  sha256,
  safeUser,
  assertOtpDevelopmentEnabled,
} from "./auth";
import { getDb } from "./queries/connection";
import { phoneVerifications, sessions, users } from "../db/schema";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Simple in-memory rate limiter (per phone per minute)
const rateBucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  for (const [k, value] of rateBucket)
    if (value.resetAt <= now) rateBucket.delete(k);
  if (!rateBucket.has(key) && rateBucket.size >= 10000)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Try again later.",
    });
  const b = rateBucket.get(key);
  if (!b || b.resetAt < now) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Try again later.",
    });
}

const phoneInput = z.object({
  countryCode: z.string().min(1).max(8),
  phone: z.string().min(3).max(20),
});

const emailInput = z.string().trim().toLowerCase().email().max(254);
const passwordInput = z.string().min(12, "Use at least 12 characters").max(128);
const credentials = z.object({ email: emailInput, password: passwordInput });
export const authRouter = createRouter({
  register: publicQuery
    .input(credentials.extend({ name: z.string(), username: z.string() }))
    .mutation(() => {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Sign up with your phone number and SMS verification.",
      });
    }),
  login: publicQuery.input(credentials).mutation(() => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Email sign-in is disabled. Sign in with your verified phone number.",
    });
  }),
  requestOtp: publicQuery.input(phoneInput).mutation(async ({ input }) => {
    assertOtpDevelopmentEnabled();
    const phone = normalizePhone(input.countryCode, input.phone);
    rateLimit(`otp:${phone}`, 5, 10 * 60 * 1000);
    const db = getDb();

    const existing = await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.phone, phone))
      .limit(1);
    const prev = existing[0];
    if (
      prev &&
      Date.now() - new Date(prev.lastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      const wait = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS -
          (Date.now() - new Date(prev.lastSentAt).getTime())) /
          1000
      );
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Please wait ${wait}s before resending.`,
      });
    }

    const otp = generateOtp();
    const record = {
      phone,
      otpHash: hashOtp(phone, otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(),
    };
    if (prev) {
      await db
        .update(phoneVerifications)
        .set(record)
        .where(eq(phoneVerifications.phone, phone));
    } else {
      await db.insert(phoneVerifications).values(record);
    }

    // Explicit development-only testing. No SMS provider has been implemented.
    return {
      ok: true,
      phone,
      expiresInSec: OTP_TTL_MS / 1000,
      // Dev-mode test OTP: never exposed in production
      devOtp: otp,
    };
  }),

  verifyOtp: publicQuery
    .input(
      phoneInput.extend({
        otp: z.string().length(6),
        name: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertOtpDevelopmentEnabled();
      const phone = normalizePhone(input.countryCode, input.phone);
      rateLimit(`verify:${phone}`, 10, 10 * 60 * 1000);
      const db = getDb();
      const rows = await db
        .select()
        .from(phoneVerifications)
        .where(eq(phoneVerifications.phone, phone))
        .limit(1);
      const rec = rows[0];
      if (!rec)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No verification requested for this number.",
        });
      if (new Date(rec.expiresAt).getTime() < Date.now())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Code expired. Request a new one.",
        });
      if (rec.attempts >= OTP_MAX_ATTEMPTS)
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Request a new code.",
        });

      if (rec.otpHash !== hashOtp(phone, input.otp)) {
        await db
          .update(phoneVerifications)
          .set({ attempts: rec.attempts + 1 })
          .where(eq(phoneVerifications.phone, phone));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect code.",
        });
      }

      // Success: consume verification, upsert user, create session
      await db
        .delete(phoneVerifications)
        .where(eq(phoneVerifications.phone, phone));
      let userRows = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      if (userRows.length === 0) {
        await db.insert(users).values({
          phone,
          countryCode: input.countryCode.startsWith("+")
            ? input.countryCode
            : `+${input.countryCode.replace(/\D/g, "")}`,
          name: input.name?.trim() || "",
          profileComplete: Boolean(input.name?.trim()),
        });
        userRows = await db
          .select()
          .from(users)
          .where(eq(users.phone, phone))
          .limit(1);
      } else if (input.name?.trim() && !userRows[0].profileComplete) {
        await db
          .update(users)
          .set({ name: input.name.trim(), profileComplete: true })
          .where(eq(users.id, userRows[0].id));
        userRows = await db
          .select()
          .from(users)
          .where(eq(users.id, userRows[0].id))
          .limit(1);
      }
      const user = userRows[0];
      const { token, expiresAt } = await createSession(
        user.id,
        ctx.req.headers.get("user-agent") ?? undefined
      );
      return { token, expiresAt, user: safeUser(user) };
    }),

  logout: sessionQuery.mutation(async ({ ctx }) => {
    await destroySession(ctx.sessionToken);
    return { ok: true };
  }),

  sessions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ctx.user.id));
    const currentHash = sha256(ctx.sessionToken);
    return rows.map(s => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.tokenHash === currentHash,
    }));
  }),
});
