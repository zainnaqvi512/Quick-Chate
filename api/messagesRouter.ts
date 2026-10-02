import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, like } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import {
  conversationParticipants,
  conversations,
  messageReactions,
  messages,
  starredMessages,
  users,
} from "../db/schema";
import { getParticipant, markRead, participantExpired } from "./expiration";
import { isBlockedBetween } from "./conversationsRouter";
import { parsePrivacy } from "./usersRouter";

const messageTypeEnum = z.enum([
  "text",
  "image",
  "video",
  "audio",
  "document",
  "location",
  "contact",
  "gif",
  "sticker",
  "call",
]);

async function shapeMessages(convId: number, meId: number, sinceCleared: Date | null) {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      sinceCleared
        ? and(eq(messages.conversationId, convId), gt(messages.createdAt, sinceCleared))
        : eq(messages.conversationId, convId),
    )
    .orderBy(asc(messages.createdAt))
    .limit(500);

  // read status: read if any OTHER participant's lastReadAt >= createdAt (respecting read-receipt privacy)
  const parts = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, convId));
  const otherParts = parts.filter((p) => p.userId !== meId);
  const readCutoffs: number[] = [];
  for (const p of otherParts) {
    const u = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
    const receiptsOn = u[0] ? parsePrivacy(u[0].privacy).readReceipts : true;
    if (p.lastReadAt && receiptsOn) readCutoffs.push(new Date(p.lastReadAt).getTime());
    if (p.lastReadAt && !receiptsOn) readCutoffs.push(0);
  }
  const deliveredCutoffs = otherParts
    .map((p) => (p.joinedAt ? new Date(p.joinedAt).getTime() : Date.now()))
    .filter(Boolean);

  const msgIds = rows.map((m) => m.id);
  const reactions =
    msgIds.length > 0
      ? await db.select().from(messageReactions).where(
          msgIds.length === 1
            ? eq(messageReactions.messageId, msgIds[0])
            : (await import("drizzle-orm")).inArray(messageReactions.messageId, msgIds),
        )
      : [];
  const stars =
    msgIds.length > 0
      ? await db
          .select()
          .from(starredMessages)
          .where(and(eq(starredMessages.userId, meId), inArray(starredMessages.messageId, msgIds)))
      : [];
  const starredIds = new Set(stars.map((s) => s.messageId));

  const senderCache = new Map<number, { id: number; name: string; avatarUrl: string | null }>();
  async function senderInfo(id: number) {
    if (!senderCache.has(id)) {
      const u = await db.select().from(users).where(eq(users.id, id)).limit(1);
      senderCache.set(id, u[0] ? { id: u[0].id, name: u[0].name || u[0].phone, avatarUrl: u[0].avatarUrl } : { id, name: "Unknown", avatarUrl: null });
    }
    return senderCache.get(id)!;
  }

  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((x): x is number => Boolean(x)))];
  const replyMap = new Map<number, { id: number; content: string | null; type: string; senderId: number }>();
  for (const rid of replyIds) {
    const r = await db.select().from(messages).where(eq(messages.id, rid)).limit(1);
    if (r[0]) replyMap.set(rid, { id: r[0].id, content: r[0].content, type: r[0].type, senderId: r[0].senderId });
  }

  const out = [];
  for (const m of rows) {
    const created = new Date(m.createdAt).getTime();
    const mine = m.senderId === meId;
    let status: "sent" | "delivered" | "read" = "sent";
    if (mine) {
      if (otherParts.length > 0) status = "delivered";
      if (readCutoffs.length > 0 && readCutoffs.every((c) => c === 0 || c >= created) && readCutoffs.some((c) => c >= created))
        status = "read";
      else if (readCutoffs.length > 0 && readCutoffs.every((c) => c >= created)) status = "read";
      void deliveredCutoffs;
    }
    out.push({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: await senderInfo(m.senderId),
      type: m.type,
      content: m.deletedForEveryone ? null : m.content,
      mediaUrl: m.deletedForEveryone ? null : m.mediaUrl,
      mediaMeta: m.deletedForEveryone ? null : m.mediaMeta,
      replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
      deletedForEveryone: m.deletedForEveryone,
      createdAt: m.createdAt,
      mine,
      status: mine ? status : undefined,
      starred: starredIds.has(m.id),
      reactions: reactions
        .filter((r) => r.messageId === m.id)
        .map((r) => ({ emoji: r.emoji, userId: r.userId })),
    });
  }
  return out;
}

export const messagesRouter = createRouter({
  /** Opening a chat = server-side read event; first read starts the 12h window. */
  list: authedQuery
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      let p = await getParticipant(input.conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant" });
      // Server-authoritative expiration enforcement — never trust the client
      if (participantExpired(p)) {
        return { expired: true, expiresAt: p.expiresAt, messages: [] };
      }
      await markRead(input.conversationId, ctx.user.id);
      p = await getParticipant(input.conversationId, ctx.user.id);
      const shaped = await shapeMessages(input.conversationId, ctx.user.id, p?.clearedAt ?? null);
      return { expired: false, expiresAt: p?.expiresAt ?? null, messages: shaped };
    }),

  send: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        type: messageTypeEnum.default("text"),
        content: z.string().max(8000).optional(),
        mediaUrl: z.string().max(2000).optional(),
        mediaMeta: z.string().max(4000).optional(),
        replyToId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const p = await getParticipant(input.conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant" });
      if (participantExpired(p))
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This chat has expired." });

      const convRows = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
      const conv = convRows[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      // Block enforcement for direct chats
      if (conv.type === "direct") {
        const parts = await db
          .select()
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, input.conversationId));
        const other = parts.find((x) => x.userId !== ctx.user.id);
        if (other && (await isBlockedBetween(ctx.user.id, other.userId)))
          throw new TRPCError({ code: "FORBIDDEN", message: "You cannot message this user." });
      }

      if (input.type === "text" && !input.content?.trim())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty message" });

      const inserted = await db.insert(messages).values({
        conversationId: input.conversationId,
        senderId: ctx.user.id,
        type: input.type,
        content: input.content ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaMeta: input.mediaMeta ?? null,
        replyToId: input.replyToId ?? null,
      });
      const id = Number((inserted as unknown as [{ insertId: number }])[0].insertId);
      // sender has obviously read their own message
      await markRead(input.conversationId, ctx.user.id);
      const rows = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
      const me = await getParticipant(input.conversationId, ctx.user.id);
      return { id, createdAt: rows[0]?.createdAt, expiresAt: me?.expiresAt ?? null };
    }),

  react: authedQuery
    .input(z.object({ messageId: z.number(), emoji: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!m[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN" });
      if (participantExpired(p)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This chat has expired." });
      const existing = await db
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.userId, ctx.user.id),
            eq(messageReactions.emoji, input.emoji),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
      } else {
        await db.insert(messageReactions).values({ messageId: input.messageId, userId: ctx.user.id, emoji: input.emoji });
      }
      return { ok: true };
    }),

  star: authedQuery
    .input(z.object({ messageId: z.number(), starred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.starred) {
        await db
          .insert(starredMessages)
          .values({ userId: ctx.user.id, messageId: input.messageId })
          .onDuplicateKeyUpdate({ set: { messageId: input.messageId } });
      } else {
        await db
          .delete(starredMessages)
          .where(and(eq(starredMessages.userId, ctx.user.id), eq(starredMessages.messageId, input.messageId)));
      }
      return { ok: true };
    }),

  starred: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(starredMessages)
      .where(eq(starredMessages.userId, ctx.user.id))
      .orderBy(desc(starredMessages.createdAt))
      .limit(100);
    const out = [];
    for (const s of rows) {
      const m = await db.select().from(messages).where(eq(messages.id, s.messageId)).limit(1);
      if (!m[0] || m[0].deletedForEveryone) continue;
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (!p || participantExpired(p)) continue; // expired content never surfaces
      out.push({ messageId: m[0].id, conversationId: m[0].conversationId, type: m[0].type, content: m[0].content, createdAt: m[0].createdAt });
    }
    return out;
  }),

  deleteForEveryone: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!m[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (m[0].senderId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the sender can delete for everyone" });
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (p && participantExpired(p)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This chat has expired." });
      await db
        .update(messages)
        .set({ deletedForEveryone: true, deletedAt: new Date(), content: null, mediaUrl: null, mediaMeta: null })
        .where(eq(messages.id, input.messageId));
      return { ok: true };
    }),

  /** Global search over non-expired conversations, messages and users. */
  search: authedQuery.input(z.object({ query: z.string().min(1).max(100) })).query(async ({ ctx, input }) => {
    const db = getDb();
    const q = `%${input.query}%`;
    // my non-expired conversations
    const myParts = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, ctx.user.id));
    const activeConvIds = myParts.filter((p) => !participantExpired(p)).map((p) => p.conversationId);

    const msgResults: { id: number; conversationId: number; content: string | null; createdAt: Date }[] = [];
    for (const cid of activeConvIds.slice(0, 50)) {
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, cid),
            like(messages.content, q),
            eq(messages.deletedForEveryone, false),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(10);
      msgResults.push(...rows.map((r) => ({ id: r.id, conversationId: r.conversationId, content: r.content, createdAt: r.createdAt })));
    }

    const userRows = await db
      .select()
      .from(users)
      .where(and(like(users.name, q)))
      .limit(10);
    return {
      messages: msgResults,
      users: userRows
        .filter((u) => u.id !== ctx.user.id)
        .map((u) => ({ id: u.id, name: u.name, phone: u.phone, avatarUrl: u.avatarUrl })),
    };
  }),
});
