import { TRPCError } from '@trpc/server';
import { MAX_UPLOAD_BYTES, storage, validateStorageKey } from './storage';
export async function assertOwnedMedia(key: string, userId: number, folder: 'chat'|'avatar'|'status') {
  try { validateStorageKey(key); } catch { throw new TRPCError({code:'BAD_REQUEST', message:'Invalid attachment key'}); }
  if (!key.startsWith(`${folder}/u${userId}/`)) throw new TRPCError({code:'FORBIDDEN', message:'You do not own this upload'});
  try { return await storage.headFile({fileKey:key}); } catch { throw new TRPCError({code:'NOT_FOUND',message:'Upload not found'}); }
}
/** Detect supported passive media by bytes; arbitrary documents download as octet-stream. */
export function decodeUpload(base64: string, declared = 'application/octet-stream') {
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new TRPCError({code:'BAD_REQUEST',message:'Invalid base64'});
  const bytes = Buffer.from(base64,'base64');
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new TRPCError({code:'PAYLOAD_TOO_LARGE',message:'File must be between 1 byte and 15 MB'});
  const mime = declared.split(';')[0].trim().toLowerCase();
  const hex = bytes.subarray(0,12).toString('hex');
  let contentType = 'application/octet-stream';
  if (hex.startsWith('89504e470d0a1a0a')) contentType='image/png';
  else if (hex.startsWith('ffd8ff')) contentType='image/jpeg';
  else if (/^GIF8[79]a/.test(bytes.subarray(0,6).toString())) contentType='image/gif';
  else if (bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP') contentType='image/webp';
  else if (bytes.subarray(4,8).toString()==='ftyp') contentType=mime==='audio/mp4'?'audio/mp4':'video/mp4';
  else if (hex.startsWith('1a45dfa3')) contentType=mime==='audio/webm'?'audio/webm':'video/webm';
  else if (bytes.subarray(0,4).toString()==='OggS') contentType='audio/ogg';
  else if (bytes.subarray(0,3).toString()==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)) contentType='audio/mpeg';
  else if (bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WAVE') contentType='audio/wav';
  if ((mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) && contentType==='application/octet-stream') throw new TRPCError({code:'BAD_REQUEST',message:'Unsupported or invalid media format'});
  return { bytes, contentType };
}
