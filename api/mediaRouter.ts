import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, eq, gt, or } from 'drizzle-orm';
import { createRouter } from './middleware';
import { authedQuery, getUserFromRequest } from './auth';
import { getDb } from './queries/connection';
import { blockedUsers, contacts, messages, statuses, users } from '../db/schema';
import { getVisibleMessage } from './retention';
import { MAX_UPLOAD_BYTES, storage, validateStorageKey } from './lib/storage';
import { decodeUpload } from './lib/mediaValidation';

async function assertReadable(key: string, userId: number) {
  try { validateStorageKey(key); } catch { throw new TRPCError({code:'NOT_FOUND'}); }
  const db = getDb();
  if (key.startsWith('chat/')) {
    const [message] = await db.select().from(messages).where(eq(messages.mediaUrl,key)).limit(1);
    if (!message || !await getVisibleMessage(message.id,userId) || (message.expirationMode==='after_view' && message.senderId!==userId)) throw new TRPCError({code:'NOT_FOUND'});
    return;
  }
  if (key.startsWith('avatar/')) {
    const [owner] = await db.select().from(users).where(eq(users.avatarUrl,key)).limit(1);
    if (!owner) throw new TRPCError({code:'NOT_FOUND'});
    if (owner.id === userId) return;
    const blocked = await db.select().from(blockedUsers).where(or(and(eq(blockedUsers.blockerId,owner.id),eq(blockedUsers.blockedId,userId)),and(eq(blockedUsers.blockerId,userId),eq(blockedUsers.blockedId,owner.id)))).limit(1);
    if (blocked.length) throw new TRPCError({code:'NOT_FOUND'});
    let privacy: {avatar?: string} = {};
    try { privacy=JSON.parse(owner.privacy || '{}'); } catch { /* default */ }
    if (privacy.avatar==='nobody') throw new TRPCError({code:'NOT_FOUND'});
    if (privacy.avatar==='contacts') {
      const rows=await db.select().from(contacts).where(and(eq(contacts.ownerId,owner.id),eq(contacts.contactUserId,userId))).limit(1);
      if (!rows.length) throw new TRPCError({code:'NOT_FOUND'});
    }
    return;
  }
  const [status] = await db.select().from(statuses).where(and(eq(statuses.mediaUrl,key),gt(statuses.expiresAt,new Date()))).limit(1);
  if (!status) throw new TRPCError({code:'NOT_FOUND'});
  if (status.userId===userId) return;
  if (status.privacy!=='contacts') throw new TRPCError({code:'NOT_FOUND'});
  const blocked=await db.select().from(blockedUsers).where(or(and(eq(blockedUsers.blockerId,status.userId),eq(blockedUsers.blockedId,userId)),and(eq(blockedUsers.blockerId,userId),eq(blockedUsers.blockedId,status.userId)))).limit(1);
  const contact=await db.select().from(contacts).where(and(eq(contacts.ownerId,status.userId),eq(contacts.contactUserId,userId))).limit(1);
  if (blocked.length || !contact.length) throw new TRPCError({code:'NOT_FOUND'});
}

export const mediaRouter=createRouter({
  upload: authedQuery.input(z.object({name:z.string().min(1).max(200),contentBase64:z.string().max(Math.ceil(MAX_UPLOAD_BYTES/3)*4),contentType:z.string().max(120).optional(),folder:z.enum(['chat','avatar','status']).default('chat')})).mutation(async ({ctx,input})=>{
    const {bytes,contentType}=decodeUpload(input.contentBase64,input.contentType);
    if(input.folder==='avatar' && !contentType.startsWith('image/')) throw new TRPCError({code:'BAD_REQUEST',message:'Avatar must be an image'});
    if(input.folder==='status' && !/^(image|video)\//.test(contentType)) throw new TRPCError({code:'BAD_REQUEST',message:'Status must be image or video'});
    const saved=await storage.uploadFile({fileContent:bytes,fileName:`${input.folder}/u${ctx.user.id}/${input.name.replace(/[^\w. -]/g,'_').slice(-80)}`,contentType});
    return {key:saved.key,size:saved.size,contentType:saved.contentType};
  }),
  url:authedQuery.input(z.object({key:z.string().max(600)})).query(async ({ctx,input})=>{
    await assertReadable(input.key,ctx.user.id);
    return {url:`/api/media?key=${encodeURIComponent(input.key)}`};
  }),
});

/** Every byte request rechecks session, membership, deletion and expiry. No public URL or query-token. */
export async function handleMediaRequest(req:Request):Promise<Response> {
  const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"};
  try {
    const auth=await getUserFromRequest(req);
    if(!auth) return new Response('Unauthorized',{status:401,headers});
    const key=new URL(req.url).searchParams.get('key') || '';
    await assertReadable(key,auth.user.id);
    const meta=await storage.headFile({fileKey:key});
    const bytes=await storage.readFile({fileKey:key});
    return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':meta.contentType,'Content-Length':String(bytes.length),'Content-Disposition':`${/^(image|audio|video)\//.test(meta.contentType)?'inline':'attachment'}; filename="${meta.fileName.replace(/[^\w. -]/g,'_')}"`}});
  } catch { return new Response('Media unavailable',{status:404,headers}); }
}
