import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import { contacts, statuses, statusViews, users } from "../db/schema";
import { STATUS_WINDOW_MS } from "./expiration";
import { assertOwnedMedia } from './lib/mediaValidation';
import { isBlockedBetween } from './conversationsRouter';

export const statusRouter = createRouter({
  /** My statuses + statuses from my contacts, not expired. */
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const now = new Date();
    const myContacts = await db.select().from(contacts).where(eq(contacts.contactUserId, ctx.user.id));
    const contactIds = new Set(myContacts.map((c) => c.ownerId));
    const rows = await db.select().from(statuses).where(gt(statuses.expiresAt, now));
    const visible = rows.filter((s) => {
      if (s.userId === ctx.user.id) return true;
      // privacy: "contacts" => poster's contacts can view. We approximate: viewer has poster as contact OR poster has viewer.
      if (!contactIds.has(s.userId)) return false;
      return s.privacy === "contacts";
    });
    const out = [];
    for (const s of visible) {
      if (s.userId !== ctx.user.id && await isBlockedBetween(s.userId,ctx.user.id)) continue;
      const u = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
      const views = await db.select().from(statusViews).where(eq(statusViews.statusId, s.id));
      out.push({
        id: s.id,
        userId: s.userId,
        userName: u[0]?.name || u[0]?.phone || "Unknown",
        userAvatar: u[0]?.avatarUrl ?? null,
        type: s.type,
        content: s.content,
        mediaUrl: s.mediaUrl,
        bgColor: s.bgColor,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        mine: s.userId === ctx.user.id,
        viewCount: views.length,
        viewedByMe: views.some((v) => v.viewerId === ctx.user.id),
      });
    }
    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return out;
  }),

  post: authedQuery
    .input(
      z.object({
        type: z.enum(["text", "image", "video"]).default("text"),
        content: z.string().max(2000).optional(),
        mediaUrl: z.string().max(2000).optional(),
        bgColor: z.string().max(16).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.type === "text" && !input.content?.trim())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty status" });
      const db = getDb();
      const now = new Date();
      if (input.mediaUrl) await assertOwnedMedia(input.mediaUrl,ctx.user.id,'status');
      await db.insert(statuses).values({
        userId: ctx.user.id,
        type: input.type,
        content: input.content ?? null,
        mediaUrl: input.mediaUrl ?? null,
        bgColor: input.bgColor ?? "#38BDF8",
        expiresAt: new Date(now.getTime() + STATUS_WINDOW_MS),
      });
      return { ok: true };
    }),

  remove: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db.delete(statuses).where(and(eq(statuses.id, input.id), eq(statuses.userId, ctx.user.id)));
    return { ok: true };
  }),

  view: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [status] = await db.select().from(statuses).where(and(eq(statuses.id,input.id),gt(statuses.expiresAt,new Date()))).limit(1);
    if(!status) throw new TRPCError({code:'NOT_FOUND'});
    if(status.userId!==ctx.user.id) {
      const contact=await db.select().from(contacts).where(and(eq(contacts.ownerId,status.userId),eq(contacts.contactUserId,ctx.user.id))).limit(1);
      if(status.privacy!=='contacts' || !contact.length || await isBlockedBetween(status.userId,ctx.user.id)) throw new TRPCError({code:'FORBIDDEN'});
    }
    await db
      .insert(statusViews)
      .values({ statusId: input.id, viewerId: ctx.user.id })
      .onDuplicateKeyUpdate({ set: { viewedAt: new Date() } });
    return { ok: true };
  }),

  viewers: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = getDb();
    const s = await db.select().from(statuses).where(eq(statuses.id, input.id)).limit(1);
    if (!s[0] || s[0].userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    const views = await db.select().from(statusViews).where(eq(statusViews.statusId, input.id));
    const out = [];
    for (const v of views) {
      const u = await db.select().from(users).where(eq(users.id, v.viewerId)).limit(1);
      if (u[0]) out.push({ name: u[0].name || u[0].phone, viewedAt: v.viewedAt });
    }
    return out;
  }),
});
