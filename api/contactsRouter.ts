import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import { contacts, users } from "../db/schema";
import { publicUser } from "./usersRouter";

export const contactsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select().from(contacts).where(eq(contacts.ownerId, ctx.user.id));
    if (rows.length === 0) return [];
    const result = [];
    for (const c of rows) {
      const u = await db.select().from(users).where(eq(users.id, c.contactUserId)).limit(1);
      if (u[0]) result.push({ contactId: c.id, alias: c.name, user: publicUser(u[0], true) });
    }
    return result;
  }),

  add: authedQuery
    .input(z.object({ userId: z.number(), name: z.string().max(128).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot add yourself" });
      const db = getDb();
      const u = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!u[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await db
        .insert(contacts)
        .values({ ownerId: ctx.user.id, contactUserId: input.userId, name: input.name || u[0].name })
        .onDuplicateKeyUpdate({ set: { name: input.name || u[0].name } });
      return { ok: true };
    }),

  remove: authedQuery.input(z.object({ userId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db
      .delete(contacts)
      .where(and(eq(contacts.ownerId, ctx.user.id), eq(contacts.contactUserId, input.userId)));
    return { ok: true };
  }),
});
