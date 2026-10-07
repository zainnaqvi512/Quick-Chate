import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { sessionQuery, createSession, normalizePhone, safeUser } from "./auth";
import { getDb } from "./queries/connection";
import { users } from "../db/schema";
import {
  checkPhoneCode,
  phoneVerificationReady,
  requestPhoneCode,
} from "./phoneVerification";

const phoneInput = z.object({
  countryCode: z.string().min(1).max(8),
  phone: z.string().min(4).max(32),
});
const codeInput = z.object({
  challenge: z.string().max(1024),
  code: z.string().regex(/^\d{4,10}$/),
});
export const phoneRouter = createRouter({
  availability: publicQuery.query(() => ({ ready: phoneVerificationReady() })),
  request: publicQuery
    .input(phoneInput)
    .mutation(({ input }) =>
      requestPhoneCode(normalizePhone(input.countryCode, input.phone))
    ),
  verify: publicQuery.input(codeInput).mutation(async ({ input, ctx }) => {
    const phone = await checkPhoneCode(input.challenge, input.code);
    const db = getDb();
    await db
      .insert(users)
      .values({ phone, name: "", profileComplete: false })
      .onDuplicateKeyUpdate({ set: { phone } });
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    const session = await createSession(
      user.id,
      ctx.req.headers.get("user-agent") ?? undefined
    );
    return { ...session, user: safeUser(user) };
  }),
  requestLink: sessionQuery.input(phoneInput).mutation(({ ctx, input }) => {
    if (ctx.user.phone)
      throw new TRPCError({
        code: "CONFLICT",
        message: "This account already has a phone number.",
      });
    return requestPhoneCode(
      normalizePhone(input.countryCode, input.phone),
      ctx.user.id
    );
  }),
  verifyLink: sessionQuery.input(codeInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.phone)
      throw new TRPCError({
        code: "CONFLICT",
        message: "This account already has a phone number.",
      });
    const phone = await checkPhoneCode(
      input.challenge,
      input.code,
      ctx.user.id
    );
    const db = getDb();
    try {
      await db
        .update(users)
        .set({ phone })
        .where(and(eq(users.id, ctx.user.id), isNull(users.phone)));
    } catch {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "That phone number cannot be linked. It may already belong to another account.",
      });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (user.phone !== phone)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Your phone number changed. Refresh and try again.",
      });
    return { ok: true };
  }),
});
