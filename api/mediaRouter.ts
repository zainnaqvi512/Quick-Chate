import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import { messages } from "../db/schema";
import { getParticipant, participantExpired } from "./expiration";
import { storage } from "./lib/storage";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const mediaRouter = createRouter({
  /** Upload a chat attachment / avatar / status media. Returns a storage key (never a URL). */
  upload: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(200),
        contentBase64: z.string().max(MAX_UPLOAD_BYTES * 1.5),
        contentType: z.string().max(120).optional(),
        folder: z.enum(["chat", "avatar", "status"]).default("chat"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (bytes.byteLength > MAX_UPLOAD_BYTES)
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File too large (max 15 MB)" });
      const safeName = input.name.replace(/[^\w.\-一-鿿 ]/g, "_").slice(-80);
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `${input.folder}/u${ctx.user.id}/${Date.now()}-${safeName}`,
        contentType: input.contentType,
      });
      return { key: saved.key, size: saved.size, contentType: saved.contentType };
    }),

  /**
   * Mint a short-lived URL for a chat-media key — only when the caller is a
   * participant of a NON-EXPIRED conversation containing that key. Expired
   * media stays inaccessible even if someone knows the key.
   */
  url: authedQuery.input(z.object({ key: z.string().max(600) })).query(async ({ ctx, input }) => {
    const key = input.key;
    // avatars are public to authenticated users
    if (key.startsWith("avatar/")) {
      return { url: (await storage.getPresignedUrl({ key })).url };
    }
    const db = getDb();
    const rows = await db.select().from(messages).where(eq(messages.mediaUrl, key)).limit(1);
    const msg = rows[0];
    if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Media not found" });
    const p = await getParticipant(msg.conversationId, ctx.user.id);
    if (!p) throw new TRPCError({ code: "FORBIDDEN", message: "No access" });
    if (participantExpired(p))
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This media has expired." });
    return { url: (await storage.getPresignedUrl({ key })).url };
  }),
});
