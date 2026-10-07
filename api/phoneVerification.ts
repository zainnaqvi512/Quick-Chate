import { createHmac, timingSafeEqual } from 'node:crypto';
import { TRPCError } from '@trpc/server';

export function phoneVerificationReady() {
  return process.env.OTP_PROVIDER === 'twilio' &&
    /^AC[0-9a-f]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID || '') &&
    /^VA[0-9a-f]{32}$/i.test(process.env.TWILIO_VERIFY_SERVICE_SID || '') &&
    !!process.env.TWILIO_AUTH_TOKEN && !!process.env.APP_SECRET &&
    !!process.env.SMS_ALLOWED_PREFIXES?.trim();
}
function unavailable(): never {
  throw new TRPCError({code:'PRECONDITION_FAILED',message:'Phone verification is not configured yet. The app owner must connect an SMS provider.'});
}
const limits = new Map<string, {count:number; until:number}>();
function limit(key:string, max:number, duration:number) {
  const now=Date.now();
  for(const [k,v] of limits) if(v.until<=now) limits.delete(k);
  const item=limits.get(key) || {count:0,until:now+duration};
  if(++item.count>max) throw new TRPCError({code:'TOO_MANY_REQUESTS',message:'Too many verification attempts. Please try again later.'});
  limits.set(key,item);
}
async function verifyApi(path:string, data:Record<string,string>) {
  if(!phoneVerificationReady()) unavailable();
  let response:Response;
  try {
    response=await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/${path}`,{
      method:'POST',signal:AbortSignal.timeout(15000),headers:{
        Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type':'application/x-www-form-urlencoded',
      },body:new URLSearchParams(data),
    });
  } catch { throw new TRPCError({code:'SERVICE_UNAVAILABLE',message:'The SMS service could not be reached. Please try again later.'}); }
  if(!response.ok) throw new TRPCError({code:'BAD_REQUEST',message:'Verification unavailable, expired, or rejected. Check your number and request a new code.'});
  return await response.json() as {sid?:string;status?:string;to?:string};
}
type Challenge={phone:string;sid:string;subject:number;expires:number};
function sign(value:string) { return createHmac('sha256',process.env.APP_SECRET!).update(value).digest('hex'); }
export async function requestPhoneCode(phone:string, subject=0) {
  if(!phoneVerificationReady()) unavailable();
  const prefixes=process.env.SMS_ALLOWED_PREFIXES!.split(',').map(s=>s.trim()).filter(s=>/^\+\d{1,4}$/.test(s));
  if(!prefixes.some(prefix=>phone.startsWith(prefix))) throw new TRPCError({code:'BAD_REQUEST',message:'SMS verification is not enabled for this country yet.'});
  // Single-replica guard; provider-side rate limits and spend controls are also required.
  limit('send:global',20,3600000); limit(`send:${phone}`,3,900000); limit(`cooldown:${phone}`,1,60000);
  const result=await verifyApi('Verifications',{To:phone,Channel:'sms'});
  if(result.status!=='pending' || !/^VE[0-9a-f]{32}$/i.test(result.sid||'')) throw new TRPCError({code:'BAD_REQUEST',message:'SMS verification could not be started.'});
  const payload=Buffer.from(JSON.stringify({phone,sid:result.sid,subject,expires:Date.now()+600000})).toString('base64url');
  return {challenge:`${payload}.${sign(payload)}`,phone,resendAfter:60};
}
export async function checkPhoneCode(challenge:string, code:string, subject=0) {
  if(!phoneVerificationReady()) unavailable();
  const [payload,signature,...extra]=challenge.split('.');
  const invalid=()=>new TRPCError({code:'UNAUTHORIZED',message:'Verification expired or invalid. Request a new code.'});
  if(extra.length || !payload || !/^[a-f0-9]{64}$/.test(signature||'') || !timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(payload),'hex'))) throw invalid();
  let parsed:Challenge;
  try { parsed=JSON.parse(Buffer.from(payload,'base64url').toString()); } catch { throw invalid(); }
  if(parsed.subject!==subject || parsed.expires<Date.now() || !/^\+[1-9]\d{7,14}$/.test(parsed.phone) || !/^VE[0-9a-f]{32}$/i.test(parsed.sid)) throw invalid();
  limit(`check:${parsed.sid}`,5,600000);
  const result=await verifyApi('VerificationCheck',{VerificationSid:parsed.sid,Code:code});
  if(result.status!=='approved' || result.to!==parsed.phone) throw invalid();
  return parsed.phone;
}
