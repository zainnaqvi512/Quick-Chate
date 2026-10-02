import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { createRouter } from "./middleware";
import { authedQuery } from "./auth";
import { getDb } from "./queries/connection";
import { calls, callSignals, conversationParticipants, users } from "../db/schema";

async function loadCall(id: number) {
  const db = getDb();
  const rows = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
  return rows[0] ?? null;
}

function assertParty(call: typeof calls.$inferSelect, userId: number) {
  if (call.callerId !== userId && call.calleeId !== userId)
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a call participant" });
}

export const callsRouter = createRouter({
  /** Caller creates the call with its WebRTC offer SDP. */
  start: authedQuery
    .input(
      z.object({
        calleeId: z.number(),
        type: z.enum(["voice", "video"]),
        offerSdp: z.string().max(20000),
        conversationId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // ensure there is a direct conversation (participants check)
      if (input.conversationId) {
        const parts = await db
          .select()
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, input.conversationId));
        const ids = new Set(parts.map((p) => p.userId));
        if (!ids.has(ctx.user.id) || !ids.has(input.calleeId))
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      const inserted = await db.insert(calls).values({
        callerId: ctx.user.id,
        calleeId: input.calleeId,
        type: input.type,
        offerSdp: input.offerSdp,
        conversationId: input.conversationId ?? null,
        status: "ringing",
      });
      const id = Number((inserted as unknown as [{ insertId: number }])[0].insertId);
      return { id };
    }),

  /** Callee polls for incoming ringing calls. */
  incoming: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const cutoff = new Date(Date.now() - 60_000);
    const rows = await db
      .select()
      .from(calls)
      .where(and(eq(calls.calleeId, ctx.user.id), eq(calls.status, "ringing"), gt(calls.createdAt, cutoff)))
      .orderBy(desc(calls.createdAt))
      .limit(1);
    const call = rows[0];
    if (!call) return null;
    const caller = await db.select().from(users).where(eq(users.id, call.callerId)).limit(1);
    return {
      id: call.id,
      type: call.type,
      offerSdp: call.offerSdp,
      caller: caller[0]
        ? { id: caller[0].id, name: caller[0].name || caller[0].phone, avatarUrl: caller[0].avatarUrl }
        : null,
      createdAt: call.createdAt,
    };
  }),

  /** Poll full call state (both parties). */
  get: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const call = await loadCall(input.id);
    if (!call) throw new TRPCError({ code: "NOT_FOUND" });
    assertParty(call, ctx.user.id);
    const isCaller = call.callerId === ctx.user.id;
    return {
      id: call.id,
      type: call.type,
      status: call.status,
      isCaller,
      // caller never needs its own offer back; callee never needs its own answer back
      offerSdp: isCaller ? null : call.offerSdp,
      answerSdp: isCaller ? call.answerSdp : null,
      createdAt: call.createdAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
    };
  }),

  accept: authedQuery
    .input(z.object({ id: z.number(), answerSdp: z.string().max(20000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const call = await loadCall(input.id);
      if (!call) throw new TRPCError({ code: "NOT_FOUND" });
      if (call.calleeId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (call.status !== "ringing") throw new TRPCError({ code: "BAD_REQUEST", message: "Call is not ringing" });
      await db
        .update(calls)
        .set({ status: "ongoing", answerSdp: input.answerSdp, answeredAt: new Date() })
        .where(eq(calls.id, input.id));
      return { ok: true };
    }),

  reject: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const call = await loadCall(input.id);
    if (!call) throw new TRPCError({ code: "NOT_FOUND" });
    if (call.calleeId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await db.update(calls).set({ status: "rejected", endedAt: new Date() }).where(eq(calls.id, input.id));
    return { ok: true };
  }),

  end: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const call = await loadCall(input.id);
    if (!call) throw new TRPCError({ code: "NOT_FOUND" });
    assertParty(call, ctx.user.id);
    const final = call.status === "ringing" ? (ctx.user.id === call.callerId ? "missed" : "missed") : "ended";
    await db.update(calls).set({ status: final, endedAt: new Date() }).where(eq(calls.id, input.id));
    return { ok: true };
  }),

  /** Append an ICE candidate. */
  signal: authedQuery
    .input(z.object({ callId: z.number(), kind: z.string().max(16), payload: z.string().max(10000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const call = await loadCall(input.callId);
      if (!call) throw new TRPCError({ code: "NOT_FOUND" });
      assertParty(call, ctx.user.id);
      await db.insert(callSignals).values({
        callId: input.callId,
        fromUserId: ctx.user.id,
        kind: input.kind,
        payload: input.payload,
      });
      return { ok: true };
    }),

  /** Poll signals after a given signal id. */
  signals: authedQuery
    .input(z.object({ callId: z.number(), afterId: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const call = await loadCall(input.callId);
      if (!call) throw new TRPCError({ code: "NOT_FOUND" });
      assertParty(call, ctx.user.id);
      const rows = await db
        .select()
        .from(callSignals)
        .where(and(eq(callSignals.callId, input.callId), gt(callSignals.id, input.afterId)));
      return rows
        .filter((r) => r.fromUserId !== ctx.user.id)
        .map((r) => ({ id: r.id, kind: r.kind, payload: r.payload }));
    }),

  /** Call history (kept independent of the 12h chat expiration). */
  history: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(calls)
      .where(or(eq(calls.callerId, ctx.user.id), eq(calls.calleeId, ctx.user.id)))
      .orderBy(desc(calls.createdAt))
      .limit(100);
    const out = [];
    for (const c of rows) {
      const otherId = c.callerId === ctx.user.id ? c.calleeId : c.callerId;
      const u = await db.select().from(users).where(eq(users.id, otherId)).limit(1);
      out.push({
        id: c.id,
        type: c.type,
        status: c.status,
        direction: c.callerId === ctx.user.id ? ("outgoing" as const) : ("incoming" as const),
        otherUser: u[0] ? { id: u[0].id, name: u[0].name || u[0].phone, avatarUrl: u[0].avatarUrl } : null,
        createdAt: c.createdAt,
        durationSec:
          c.answeredAt && c.endedAt
            ? Math.max(0, Math.round((new Date(c.endedAt).getTime() - new Date(c.answeredAt).getTime()) / 1000))
            : 0,
      });
    }
    return out;
  }),
});
