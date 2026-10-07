import { TRPCError } from "@trpc/server";
import { contactLookup } from "./contactLookup";
import { z } from "zod";
import { and, eq, ne, or } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery, sessionQuery, safeUser } from "./auth";
import { assertOwnedMedia } from "./lib/mediaValidation";
import { getDb } from "./queries/connection";
import { blockedUsers, users, contacts, sessions } from "../db/schema";

export const DEFAULT_PRIVACY = {
  lastSeen: "everyone" as "everyone" | "contacts" | "nobody",
  avatar: "everyone" as "everyone" | "contacts" | "nobody",
  about: "everyone" as "everyone" | "contacts" | "nobody",
  readReceipts: true,
};
export const DEFAULT_NOTIFY = {
  messages: true,
  groups: true,
  calls: true,
  sounds: true,
};

export function parsePrivacy(raw: string | null) {
  try {
    return { ...DEFAULT_PRIVACY, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}
export function parseNotify(raw: string | null) {
  try {
    return { ...DEFAULT_NOTIFY, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_NOTIFY };
  }
}

/** Shape a user record for another viewer, honoring privacy settings. */
export function publicUser(
  u: typeof users.$inferSelect,
  viewerIsContact: boolean
) {
  const p = parsePrivacy(u.privacy);
  const allow = (k: "lastSeen" | "avatar" | "about") =>
    p[k] === "everyone" || (p[k] === "contacts" && viewerIsContact);
  return {
    id: u.id,
    phone: u.phone,
    username: u.username,
    name: u.name,
    about: allow("about") ? u.about : "",
    avatarUrl: allow("avatar") ? u.avatarUrl : null,
    lastSeenAt: allow("lastSeen") ? u.lastSeenAt : null,
    createdAt: u.createdAt,
  };
}

export const usersRouter = createRouter({
  me: sessionQuery.query(({ ctx }) => {
    return {
      ...ctx.user,
      privacy: parsePrivacy(ctx.user.privacy),
      notifySettings: parseNotify(ctx.user.notifySettings),
    };
  }),

  updateMe: authedQuery
    .input(
      z.object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z][a-z0-9_]{2,31}$/,
            "Use 3–32 letters, numbers or underscores, starting with a letter"
          )
          .optional(),
        name: z.string().min(1).max(128).optional(),
        about: z.string().max(512).optional(),
        avatarUrl: z.string().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.avatarUrl)
        await assertOwnedMedia(input.avatarUrl, ctx.user.id, "avatar");
      try {
        await db
          .update(users)
          .set({ ...input, profileComplete: true })
          .where(eq(users.id, ctx.user.id));
      } catch (error) {
        const e = error as { code?: string; cause?: { code?: string } };
        if (e.code === "ER_DUP_ENTRY" || e.cause?.code === "ER_DUP_ENTRY")
          throw new TRPCError({
            code: "CONFLICT",
            message: "That username is already taken.",
          });
        throw error;
      }
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      return safeUser(rows[0]);
    }),

  updatePrivacy: authedQuery
    .input(
      z.object({
        lastSeen: z.enum(["everyone", "contacts", "nobody"]),
        avatar: z.enum(["everyone", "contacts", "nobody"]),
        about: z.enum(["everyone", "contacts", "nobody"]),
        readReceipts: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({ privacy: JSON.stringify(input) })
        .where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  updateNotify: authedQuery
    .input(
      z.object({
        messages: z.boolean(),
        groups: z.boolean(),
        calls: z.boolean(),
        sounds: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({ notifySettings: JSON.stringify(input) })
        .where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  search: authedQuery
    .input(
      z.object({
        query: z.string().min(1).max(64),
        countryCode: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return searchExactUsers(input.query, ctx.user.id, input.countryCode);
    }),

  block: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(blockedUsers)
        .values({ blockerId: ctx.user.id, blockedId: input.userId })
        .onDuplicateKeyUpdate({ set: { blockedId: input.userId } });
      return { ok: true };
    }),

  unblock: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(blockedUsers)
        .where(
          and(
            eq(blockedUsers.blockerId, ctx.user.id),
            eq(blockedUsers.blockedId, input.userId)
          )
        );
      return { ok: true };
    }),

  blocked: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, ctx.user.id));
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.blockedId);
    const us = await db
      .select()
      .from(users)
      .where(or(...ids.map(id => eq(users.id, id))));
    return us.map(u => publicUser(u, true));
  }),

  deleteAccount: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));
    await db.delete(users).where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),
});

export async function searchExactUsers(
  query: string,
  viewerId: number,
  countryCode?: string
) {
  const identity = contactLookup(query, countryCode);
  if (!identity) return [];
  const db = getDb();
  const results = await db
    .select()
    .from(users)
    .where(
      and(
        "phone" in identity
          ? eq(users.phone, identity.phone)
          : eq(users.username, identity.username),
        ne(users.id, viewerId)
      )
    )
    .limit(1);
  const visible = [];
  for (const u of results) {
    if (!u.phone) continue;
    const blocked = await db
      .select()
      .from(blockedUsers)
      .where(
        or(
          and(
            eq(blockedUsers.blockerId, u.id),
            eq(blockedUsers.blockedId, viewerId)
          ),
          and(
            eq(blockedUsers.blockerId, viewerId),
            eq(blockedUsers.blockedId, u.id)
          )
        )
      )
      .limit(1);
    if (blocked.length) continue;
    const contact = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.ownerId, u.id), eq(contacts.contactUserId, viewerId))
      )
      .limit(1);
    visible.push(publicUser(u, contact.length > 0));
  }
  return visible;
}
