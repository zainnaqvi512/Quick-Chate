import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import {
  blockedUsers,
  conversationParticipants,
  conversations,
  messages,
  typingStates,
  users,
} from "../db/schema";
import { getParticipant, markRead, participantExpired } from "./expiration";
import { publicUser } from "./usersRouter";

async function requireMembership(convId: number, userId: number) {
  const p = await getParticipant(convId, userId);
  if (!p) throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant of this conversation" });
  return p;
}

async function isBlockedBetween(a: number, b: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(blockedUsers)
    .where(
      or(
        and(eq(blockedUsers.blockerId, a), eq(blockedUsers.blockedId, b)),
        and(eq(blockedUsers.blockerId, b), eq(blockedUsers.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function convDisplay(conv: typeof conversations.$inferSelect, meId: number) {
  const db = getDb();
  if (conv.type === "group") {
    return { title: conv.name || "Group", avatarUrl: conv.avatarUrl, otherUser: null as null | ReturnType<typeof publicUser> };
  }
  const parts = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conv.id));
  const otherId = parts.find((p) => p.userId !== meId)?.userId;
  if (!otherId) return { title: "Unknown", avatarUrl: null, otherUser: null };
  const u = await db.select().from(users).where(eq(users.id, otherId)).limit(1);
  if (!u[0]) return { title: "Unknown", avatarUrl: null, otherUser: null };
  const pub = publicUser(u[0], true);
  return { title: pub.name || pub.phone, avatarUrl: pub.avatarUrl, otherUser: pub };
}

async function lastMessagePreview(convId: number, clearedAt: Date | null) {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      clearedAt
        ? and(eq(messages.conversationId, convId), gt(messages.createdAt, clearedAt))
        : eq(messages.conversationId, convId),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export const conversationsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myParts = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, ctx.user.id));
    const result = [];
    for (const p of myParts) {
      const convRows = await db.select().from(conversations).where(eq(conversations.id, p.conversationId)).limit(1);
      const conv = convRows[0];
      if (!conv) continue;
      const expired = participantExpired(p);
      const display = await convDisplay(conv, ctx.user.id);
      const last = expired ? null : await lastMessagePreview(conv.id, p.clearedAt);
      let unread = 0;
      if (!expired && p.lastReadAt) {
        const unreadRows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              gt(messages.createdAt, p.lastReadAt),
              eq(messages.deletedForEveryone, false),
            ),
          );
        unread = unreadRows.filter(() => true).length;
        // exclude own messages
        const ownRows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              gt(messages.createdAt, p.lastReadAt),
              eq(messages.senderId, ctx.user.id),
            ),
          );
        unread -= ownRows.length;
      } else if (!expired && !p.lastReadAt) {
        const all = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, conv.id), eq(messages.deletedForEveryone, false)));
        const own = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, conv.id), eq(messages.senderId, ctx.user.id)));
        unread = all.length - own.length;
      }
      result.push({
        id: conv.id,
        type: conv.type,
        title: display.title,
        avatarUrl: display.avatarUrl,
        otherUser: display.otherUser,
        myRole: p.role,
        pinned: p.pinned,
        archived: p.archived,
        muted: p.muted,
        expiresAt: p.expiresAt,
        expired,
        unread,
        lastMessage: last
          ? { type: last.type, content: last.content, senderId: last.senderId, createdAt: last.createdAt }
          : null,
        createdAt: conv.createdAt,
      });
    }
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    return result;
  }),

  createDirect: authedQuery.input(z.object({ userId: z.number() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot chat with yourself" });
    const db = getDb();
    const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    const [a, b] = [ctx.user.id, input.userId].sort((x, y) => x - y);
    const directKey = `${a}:${b}`;
    const existing = await db.select().from(conversations).where(eq(conversations.directKey, directKey)).limit(1);
    if (existing[0]) {
      // ensure both participant rows exist (conversation shell may have been purged)
      const parts = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, existing[0].id));
      const have = new Set(parts.map((p) => p.userId));
      for (const uid of [a, b]) {
        if (!have.has(uid))
          await db.insert(conversationParticipants).values({ conversationId: existing[0].id, userId: uid });
      }
      return { id: existing[0].id };
    }
    const inserted = await db
      .insert(conversations)
      .values({ type: "direct", directKey, createdBy: ctx.user.id });
    const convId = Number((inserted as unknown as [{ insertId: number }])[0].insertId);
    await db.insert(conversationParticipants).values([
      { conversationId: convId, userId: a },
      { conversationId: convId, userId: b },
    ]);
    return { id: convId };
  }),

  createGroup: authedQuery
    .input(z.object({ name: z.string().min(1).max(128), memberIds: z.array(z.number()).min(1).max(256) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const inserted = await db
        .insert(conversations)
        .values({ type: "group", name: input.name, createdBy: ctx.user.id });
      const convId = Number((inserted as unknown as [{ insertId: number }])[0].insertId);
      const ids = [...new Set([ctx.user.id, ...input.memberIds])];
      await db.insert(conversationParticipants).values(
        ids.map((uid) => ({
          conversationId: convId,
          userId: uid,
          role: uid === ctx.user.id ? ("owner" as const) : ("member" as const),
        })),
      );
      return { id: convId };
    }),

  get: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = getDb();
    const p = await requireMembership(input.id, ctx.user.id);
    const convRows = await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1);
    const conv = convRows[0];
    if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
    const display = await convDisplay(conv, ctx.user.id);
    const parts = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conv.id));
    const participants = [];
    for (const part of parts) {
      const u = await db.select().from(users).where(eq(users.id, part.userId)).limit(1);
      if (u[0])
        participants.push({
          user: publicUser(u[0], true),
          role: part.role,
          lastReadAt: part.lastReadAt,
          expiresAt: part.expiresAt,
        });
    }
    return {
      id: conv.id,
      type: conv.type,
      title: display.title,
      avatarUrl: display.avatarUrl,
      description: conv.description,
      otherUser: display.otherUser,
      myRole: p.role,
      myExpiresAt: p.expiresAt,
      expired: participantExpired(p),
      pinned: p.pinned,
      archived: p.archived,
      muted: p.muted,
      participants,
      createdAt: conv.createdAt,
    };
  }),

  /** Server records the read/open event; first read starts the 12h window. */
  read: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const first = await requireMembership(input.id, ctx.user.id);
    if (participantExpired(first)) {
      return { ok: false, expired: true, expiresAt: first.expiresAt };
    }
    await markRead(input.id, ctx.user.id);
    const p = await getParticipant(input.id, ctx.user.id);
    return { ok: true, expired: false, expiresAt: p?.expiresAt ?? null };
  }),

  setFlags: authedQuery
    .input(
      z.object({
        id: z.number(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
        muted: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.id, ctx.user.id);
      const db = getDb();
      const set: Record<string, boolean> = {};
      if (input.pinned !== undefined) set.pinned = input.pinned;
      if (input.archived !== undefined) set.archived = input.archived;
      if (input.muted !== undefined) set.muted = input.muted;
      if (Object.keys(set).length === 0) return { ok: true };
      await db
        .update(conversationParticipants)
        .set(set)
        .where(
          and(
            eq(conversationParticipants.conversationId, input.id),
            eq(conversationParticipants.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  clear: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await requireMembership(input.id, ctx.user.id);
    const db = getDb();
    await db
      .update(conversationParticipants)
      .set({ clearedAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, input.id),
          eq(conversationParticipants.userId, ctx.user.id),
        ),
      );
    return { ok: true };
  }),

  addMember: authedQuery
    .input(z.object({ id: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const me = await requireMembership(input.id, ctx.user.id);
      if (me.role === "member") throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
      const db = getDb();
      await db
        .insert(conversationParticipants)
        .values({ conversationId: input.id, userId: input.userId })
        .onDuplicateKeyUpdate({ set: { conversationId: input.id } });
      return { ok: true };
    }),

  removeMember: authedQuery
    .input(z.object({ id: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const me = await requireMembership(input.id, ctx.user.id);
      if (me.role === "member" && input.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
      const db = getDb();
      await db
        .delete(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, input.id),
            eq(conversationParticipants.userId, input.userId),
          ),
        );
      return { ok: true };
    }),

  updateGroup: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await requireMembership(input.id, ctx.user.id);
      if (me.role === "member") throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
      const db = getDb();
      const set: Record<string, string> = {};
      if (input.name) set.name = input.name;
      if (input.description !== undefined) set.description = input.description;
      await db.update(conversations).set(set).where(eq(conversations.id, input.id));
      return { ok: true };
    }),

  typing: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.id, ctx.user.id);
      const db = getDb();
      await db
        .insert(typingStates)
        .values({ conversationId: input.id, userId: ctx.user.id, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
      return { ok: true };
    }),

  typingList: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    await requireMembership(input.id, ctx.user.id);
    const db = getDb();
    const cutoff = new Date(Date.now() - 6000);
    const rows = await db
      .select()
      .from(typingStates)
      .where(and(eq(typingStates.conversationId, input.id), gt(typingStates.updatedAt, cutoff)));
    const out = [];
    for (const r of rows) {
      if (r.userId === ctx.user.id) continue;
      const u = await db.select().from(users).where(eq(users.id, r.userId)).limit(1);
      if (u[0]) out.push({ userId: r.userId, name: u[0].name || u[0].phone });
    }
    return out;
  }),
});

export { isBlockedBetween };
