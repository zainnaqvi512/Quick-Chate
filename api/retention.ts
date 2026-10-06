import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { messages, messageReceipts } from "../db/schema";
import { getDb } from "./queries/connection";

export const EXPIRATION_MODES = ["after_view", "1h", "12h", "24h"] as const;
export type ExpirationMode = typeof EXPIRATION_MODES[number];
export const UNREAD_CAP_MS = 7 * 24 * 3600 * 1000;
export function retentionDeadlineForSend(now = new Date()): Date {
  return new Date(now.getTime() + UNREAD_CAP_MS);
}
export function viewingDeadline(mode: string, viewedAt: Date, hardDeadline: Date): Date {
  const durations: Record<string, number> = { after_view: 0, "1h": 3600000, "12h": 43200000, "24h": 86400000 };
  return new Date(Math.min(viewedAt.getTime() + (durations[mode] ?? durations["24h"]), hardDeadline.getTime()));
}
export function receiptIsLive(receipt: { expiresAt: Date | null; consumedAt: Date | null }, deadline: Date, now = new Date()): boolean {
  return deadline.getTime() > now.getTime() && !receipt.consumedAt && (!receipt.expiresAt || receipt.expiresAt.getTime() > now.getTime());
}

/** Apply on EVERY content-bearing read, including replies, search and media. */
export function visibleMessagePredicate(userId: number, now = new Date()) {
  return sql`${messages.deletedForEveryone} = false
    AND ${messages.retentionDeadline} > ${now}
    AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = ${messages.conversationId}
      AND cp.user_id = ${userId} AND (cp.cleared_at IS NULL OR ${messages.createdAt} > cp.cleared_at))
    AND (( ${messages.senderId} = ${userId} AND (
      NOT EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = ${messages.id})
      OR EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = ${messages.id}
        AND r.consumed_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > ${now})
        AND EXISTS (SELECT 1 FROM conversation_participants live_cp WHERE live_cp.conversation_id = ${messages.conversationId} AND live_cp.user_id = r.user_id))
    )) OR EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = ${messages.id}
      AND r.user_id = ${userId} AND r.consumed_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > ${now})))`;
}
export async function getVisibleMessage(messageId: number, userId: number) {
  const rows = await getDb().select().from(messages).where(and(eq(messages.id, messageId), visibleMessagePredicate(userId))).limit(1);
  return rows[0] ?? null;
}
export async function getVisibleMessages(conversationId: number, userId: number, limit = 50, beforeId?: number) {
  return getDb().select().from(messages).where(and(eq(messages.conversationId, conversationId), visibleMessagePredicate(userId), beforeId ? sql`${messages.id} < ${beforeId}` : undefined)).orderBy(desc(messages.id)).limit(Math.min(Math.max(limit, 1), 100));
}
type Writer = Pick<ReturnType<typeof getDb>, "insert">;
export async function createRecipientSnapshot(messageId: number, recipientUserIds: number[], writer: Writer = getDb()) {
  const ids = [...new Set(recipientUserIds)];
  if (ids.length) await writer.insert(messageReceipts).values(ids.map(userId => ({ messageId, userId })));
}
/** Conditional update makes the FIRST acknowledgement authoritative across devices. */
export async function acknowledgeMessages(messageIds: number[], userId: number, event: "delivered" | "viewed") {
  const db = getDb();
  for (const id of [...new Set(messageIds)].slice(0, 100)) {
    const message = await getVisibleMessage(id, userId);
    if (!message || message.senderId === userId) continue;
    const now = new Date();
    const pair = and(eq(messageReceipts.messageId, id), eq(messageReceipts.userId, userId));
    await db.update(messageReceipts).set({ deliveredAt: now }).where(and(pair, isNull(messageReceipts.deliveredAt)));
    if (event === "viewed" && message.expirationMode !== "after_view") {
      await db.update(messageReceipts).set({ viewedAt: now, expiresAt: viewingDeadline(message.expirationMode, now, message.retentionDeadline), consumedAt: message.expirationMode === "after_view" ? now : null })
        .where(and(pair, isNull(messageReceipts.viewedAt), sql`${message.retentionDeadline} > ${now}`));
    }
  }
}

/** Select only globally inaccessible rows. Workers may retry safely after media errors. */
export function globallyExpiredPredicate(now = new Date()) {
  return sql`${messages.retentionDeadline} <= ${now} OR ${messages.deletedForEveryone} = true OR (
    EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = ${messages.id})
    AND NOT EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = ${messages.id}
      AND r.consumed_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > ${now})
      AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = ${messages.conversationId} AND cp.user_id = r.user_id)))`;
}

/** One winner across concurrent devices. Caller returns content only for that winner. */
export async function consumeAfterView(messageId: number, userId: number) {
  const message = await getVisibleMessage(messageId, userId);
  if (!message || message.senderId === userId || message.expirationMode !== "after_view") return null;
  const now = new Date();
  const [result] = await getDb().update(messageReceipts).set({
    deliveredAt: now, viewedAt: now, expiresAt: now, consumedAt: now,
  }).where(and(eq(messageReceipts.messageId, messageId), eq(messageReceipts.userId, userId), isNull(messageReceipts.viewedAt), isNull(messageReceipts.consumedAt), sql`${message.retentionDeadline} > ${now}`));
  return result.affectedRows === 1 ? message : null;
}
