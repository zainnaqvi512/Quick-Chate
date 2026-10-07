import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import {
  conversationParticipants,
  conversations,
  messageReactions,
  messageReceipts,
  messages,
  starredMessages,
  users,
} from "../db/schema";
import { getParticipant, participantExpired } from "./expiration";
import { isBlockedBetween } from "./conversationsRouter";
import {
  consumeAfterView,
  acknowledgeMessages,
  createRecipientSnapshot,
  getVisibleMessage,
  getVisibleMessages,
  retentionDeadlineForSend,
  visibleMessagePredicate,
} from "./retention";
import { storage, validateStorageKey } from "./lib/storage";
import { parsePrivacy, searchExactUsers } from "./usersRouter";

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

async function shapeMessages(
  convId: number,
  meId: number,
  limit: number,
  beforeId?: number
) {
  const db = getDb();
  const rows = (
    await getVisibleMessages(convId, meId, limit, beforeId)
  ).reverse();
  const msgIds = rows.map(m => m.id);
  const reactions =
    msgIds.length > 0
      ? await db
          .select()
          .from(messageReactions)
          .where(
            msgIds.length === 1
              ? eq(messageReactions.messageId, msgIds[0])
              : (await import("drizzle-orm")).inArray(
                  messageReactions.messageId,
                  msgIds
                )
          )
      : [];
  const stars =
    msgIds.length > 0
      ? await db
          .select()
          .from(starredMessages)
          .where(
            and(
              eq(starredMessages.userId, meId),
              inArray(starredMessages.messageId, msgIds)
            )
          )
      : [];
  const starredIds = new Set(stars.map(s => s.messageId));

  const senderCache = new Map<
    number,
    { id: number; name: string; avatarUrl: string | null }
  >();
  async function senderInfo(id: number) {
    if (!senderCache.has(id)) {
      const u = await db.select().from(users).where(eq(users.id, id)).limit(1);
      senderCache.set(
        id,
        u[0]
          ? {
              id: u[0].id,
              name: u[0].name || u[0].username || "User",
              avatarUrl: u[0].avatarUrl,
            }
          : { id, name: "Unknown", avatarUrl: null }
      );
    }
    return senderCache.get(id)!;
  }

  const replyIds = [
    ...new Set(
      rows.map(m => m.replyToId).filter((x): x is number => Boolean(x))
    ),
  ];
  const replyMap = new Map<
    number,
    { id: number; content: string | null; type: string; senderId: number }
  >();
  for (const rid of replyIds) {
    const r = await getVisibleMessage(rid, meId);
    if (
      r &&
      r.conversationId === convId &&
      !r.deletedForEveryone &&
      r.expirationMode !== "after_view"
    )
      replyMap.set(rid, {
        id: r.id,
        content: r.content,
        type: r.type,
        senderId: r.senderId,
      });
  }

  const out = [];
  for (const m of rows) {
    const mine = m.senderId === meId;
    const receipts = await db
      .select()
      .from(messageReceipts)
      .where(eq(messageReceipts.messageId, m.id));
    let status: "sent" | "delivered" | "read" = "sent";
    if (mine && receipts.length && receipts.every(r => r.deliveredAt))
      status = "delivered";
    if (mine && receipts.length && receipts.every(r => r.viewedAt)) {
      const recipients = await db
        .select()
        .from(users)
        .where(
          inArray(
            users.id,
            receipts.map(r => r.userId)
          )
        );
      if (recipients.every(u => parsePrivacy(u.privacy).readReceipts))
        status = "read";
    }
    out.push({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: await senderInfo(m.senderId),
      type: m.type,
      content:
        m.deletedForEveryone || (!mine && m.expirationMode === "after_view")
          ? null
          : m.content,
      mediaUrl:
        m.deletedForEveryone || (!mine && m.expirationMode === "after_view")
          ? null
          : m.mediaUrl,
      mediaMeta:
        m.deletedForEveryone || (!mine && m.expirationMode === "after_view")
          ? null
          : m.mediaMeta,
      replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
      deletedForEveryone: m.deletedForEveryone,
      createdAt: m.createdAt,
      expirationMode: m.expirationMode,
      expiresAt: mine
        ? m.retentionDeadline
        : (receipts.find(r => r.userId === meId)?.expiresAt ??
          m.retentionDeadline),
      mine,
      status: mine ? status : undefined,
      starred: starredIds.has(m.id),
      reactions: reactions
        .filter(r => r.messageId === m.id)
        .map(r => ({ emoji: r.emoji, userId: r.userId })),
    });
  }
  return out;
}

export const messagesRouter = createRouter({
  // Fetches never constitute viewing. Clients explicitly acknowledge rendered messages.
  list: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        limit: z.number().int().min(1).max(100).default(50),
        beforeId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const p = await getParticipant(input.conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN" });
      const shaped = await shapeMessages(
        input.conversationId,
        ctx.user.id,
        input.limit,
        input.beforeId
      );
      return {
        expired: false,
        expiresAt: null,
        messages: shaped,
        nextCursor: shaped.length === input.limit ? shaped[0]?.id : null,
      };
    }),
  reveal: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const candidate = await getVisibleMessage(input.messageId, ctx.user.id);
      if (
        !candidate ||
        candidate.senderId === ctx.user.id ||
        candidate.expirationMode !== "after_view"
      )
        throw new TRPCError({ code: "NOT_FOUND" });
      let attachment: {
        base64: string;
        contentType: string;
        fileName: string;
      } | null = null;
      if (candidate.mediaUrl) {
        const meta = await storage.headFile({ fileKey: candidate.mediaUrl });
        const bytes = await storage.readFile({ fileKey: candidate.mediaUrl });
        attachment = {
          base64: bytes.toString("base64"),
          contentType: meta.contentType,
          fileName: meta.fileName,
        };
      }
      const message = await consumeAfterView(input.messageId, ctx.user.id);
      if (!message)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View-once message is no longer available",
        });
      return { ...message, attachment };
    }),
  acknowledge: authedQuery
    .input(
      z.object({
        messageIds: z.array(z.number()).min(1).max(100),
        event: z.enum(["delivered", "viewed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await acknowledgeMessages(input.messageIds, ctx.user.id, input.event);
      return { ok: true };
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
        forwardFromId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      let retentionDeadline = retentionDeadlineForSend();
      if (input.forwardFromId) {
        const source = await getVisibleMessage(
          input.forwardFromId,
          ctx.user.id
        );
        if (!source || source.expirationMode === "after_view")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This message cannot be forwarded",
          });
        if (source.mediaUrl)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Media forwarding is not available yet",
          });
        const [receipt] = await db
          .select()
          .from(messageReceipts)
          .where(
            and(
              eq(messageReceipts.messageId, source.id),
              eq(messageReceipts.userId, ctx.user.id)
            )
          )
          .limit(1);
        retentionDeadline = new Date(
          Math.min(
            source.retentionDeadline.getTime(),
            receipt?.expiresAt?.getTime() ?? Infinity
          )
        );
        input.content = source.content ?? undefined;
        input.mediaMeta = source.mediaMeta ?? undefined;
        input.type = source.type;
        input.mediaUrl = undefined;
      }
      const p = await getParticipant(input.conversationId, ctx.user.id);
      if (!p)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant",
        });
      if (participantExpired(p))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This chat has expired.",
        });

      const convRows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);
      const conv = convRows[0];
      if (!conv)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });

      // Block enforcement for direct chats
      if (conv.type === "direct") {
        const parts = await db
          .select()
          .from(conversationParticipants)
          .where(
            eq(conversationParticipants.conversationId, input.conversationId)
          );
        const other = parts.find(x => x.userId !== ctx.user.id);
        if (other && (await isBlockedBetween(ctx.user.id, other.userId)))
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot message this user.",
          });
      }

      if (input.mediaUrl) {
        try {
          validateStorageKey(input.mediaUrl);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid media key",
          });
        }
        if (!input.mediaUrl.startsWith(`chat/u${ctx.user.id}/`))
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Upload your own attachment",
          });
        await storage.headFile({ fileKey: input.mediaUrl });
        const reused = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.mediaUrl, input.mediaUrl))
          .limit(1);
        if (reused.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Re-upload attachments to forward them",
          });
      }
      if (input.type === "text" && !input.content?.trim())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty message" });

      if (input.replyToId) {
        const reply = await getVisibleMessage(input.replyToId, ctx.user.id);
        if (
          !reply ||
          reply.conversationId !== input.conversationId ||
          reply.expirationMode === "after_view"
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reply target is unavailable",
          });
      }
      const parts = await db
        .select()
        .from(conversationParticipants)
        .where(
          eq(conversationParticipants.conversationId, input.conversationId)
        );
      const id = await db.transaction(async tx => {
        const inserted = await tx.insert(messages).values({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          type: input.type,
          content: input.content ?? null,
          mediaUrl: input.mediaUrl ?? null,
          mediaMeta: input.mediaMeta ?? null,
          replyToId: input.replyToId ?? null,
          expirationMode: conv.expirationMode,
          retentionDeadline,
        });
        const id = Number(
          (inserted as unknown as [{ insertId: number }])[0].insertId
        );
        await createRecipientSnapshot(
          id,
          parts.filter(p => p.userId !== ctx.user.id).map(p => p.userId),
          tx
        );
        return id;
      });
      return { id, createdAt: new Date(), expiresAt: null };
    }),

  react: authedQuery
    .input(
      z.object({ messageId: z.number(), emoji: z.string().min(1).max(16) })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const visible = await getVisibleMessage(input.messageId, ctx.user.id);
      const m = visible ? [visible] : [];
      if (!m[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN" });
      if (participantExpired(p))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This chat has expired.",
        });
      const existing = await db
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.userId, ctx.user.id),
            eq(messageReactions.emoji, input.emoji)
          )
        )
        .limit(1);
      if (existing[0]) {
        await db
          .delete(messageReactions)
          .where(eq(messageReactions.id, existing[0].id));
      } else {
        await db
          .insert(messageReactions)
          .values({
            messageId: input.messageId,
            userId: ctx.user.id,
            emoji: input.emoji,
          });
      }
      return { ok: true };
    }),

  star: authedQuery
    .input(z.object({ messageId: z.number(), starred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!(await getVisibleMessage(input.messageId, ctx.user.id)))
        throw new TRPCError({ code: "NOT_FOUND" });
      if (input.starred) {
        await db
          .insert(starredMessages)
          .values({ userId: ctx.user.id, messageId: input.messageId })
          .onDuplicateKeyUpdate({ set: { messageId: input.messageId } });
      } else {
        await db
          .delete(starredMessages)
          .where(
            and(
              eq(starredMessages.userId, ctx.user.id),
              eq(starredMessages.messageId, input.messageId)
            )
          );
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
      const visible = await getVisibleMessage(s.messageId, ctx.user.id);
      const m = visible ? [visible] : [];
      if (
        !m[0] ||
        m[0].deletedForEveryone ||
        m[0].expirationMode === "after_view"
      )
        continue;
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (!p || participantExpired(p)) continue; // expired content never surfaces
      out.push({
        messageId: m[0].id,
        conversationId: m[0].conversationId,
        type: m[0].type,
        content: m[0].content,
        createdAt: m[0].createdAt,
      });
    }
    return out;
  }),

  edit: authedQuery
    .input(
      z.object({
        messageId: z.number(),
        content: z.string().trim().min(1).max(8000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const m = await getVisibleMessage(input.messageId, ctx.user.id);
      if (!m || m.senderId !== ctx.user.id || m.type !== "text")
        throw new TRPCError({ code: "FORBIDDEN" });
      if (Date.now() - m.createdAt.getTime() > 15 * 60 * 1000)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Editing is available for 15 minutes",
        });
      await getDb()
        .update(messages)
        .set({ content: input.content, editedAt: new Date() })
        .where(eq(messages.id, m.id));
      return { ok: true };
    }),

  deleteForEveryone: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const visible = await getVisibleMessage(input.messageId, ctx.user.id);
      const m = visible ? [visible] : [];
      if (!m[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (m[0].senderId !== ctx.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the sender can delete for everyone",
        });
      const p = await getParticipant(m[0].conversationId, ctx.user.id);
      if (!p) throw new TRPCError({ code: "FORBIDDEN" });
      if (participantExpired(p))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This chat has expired.",
        });
      await db
        .update(messages)
        .set({
          deletedForEveryone: true,
          deletedAt: new Date(),
          content: null,
          mediaMeta: null,
        })
        .where(eq(messages.id, input.messageId));
      return { ok: true };
    }),

  /** Global search over non-expired conversations, messages and users. */
  search: authedQuery
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const q = `%${input.query}%`;
      // my non-expired conversations
      const myParts = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, ctx.user.id));
      const activeConvIds = myParts
        .filter(p => !participantExpired(p))
        .map(p => p.conversationId);

      const msgResults: {
        id: number;
        conversationId: number;
        content: string | null;
        createdAt: Date;
      }[] = [];
      for (const cid of activeConvIds.slice(0, 50)) {
        const rows = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, cid),
              like(messages.content, q),
              visibleMessagePredicate(ctx.user.id),
              (await import("drizzle-orm")).ne(
                messages.expirationMode,
                "after_view"
              ),
              eq(messages.deletedForEveryone, false)
            )
          )
          .orderBy(desc(messages.createdAt))
          .limit(10);
        msgResults.push(
          ...rows.map(r => ({
            id: r.id,
            conversationId: r.conversationId,
            content: r.content,
            createdAt: r.createdAt,
          }))
        );
      }

      return {
        messages: msgResults,
        users: await searchExactUsers(input.query, ctx.user.id),
      };
    }),
});
