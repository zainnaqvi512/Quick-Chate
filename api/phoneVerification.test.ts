import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPhoneCode, phoneVerificationReady, requestPhoneCode } from './phoneVerification';

beforeEach(()=>{
  vi.stubEnv('OTP_PROVIDER','twilio');vi.stubEnv('TWILIO_ACCOUNT_SID','AC'+'a'.repeat(32));
  vi.stubEnv('TWILIO_VERIFY_SERVICE_SID','VA'+'a'.repeat(32));vi.stubEnv('TWILIO_AUTH_TOKEN','test-only');
  vi.stubEnv('APP_SECRET','test-only-app-secret');vi.stubEnv('SMS_ALLOWED_PREFIXES','+92');
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('provider-backed phone verification',()=>{
  it('fails closed without provider configuration',async()=>{
    vi.stubEnv('TWILIO_AUTH_TOKEN',''); expect(phoneVerificationReady()).toBe(false);
    await expect(requestPhoneCode('+923001234567')).rejects.toThrow('not configured');
  });
  it('does not send outside the configured countries',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(requestPhoneCode('+14155552671')).rejects.toThrow('not enabled');expect(fetch).not.toHaveBeenCalled();
  });
  it('binds the challenge to the account, requires approved status, and does not return an OTP',async()=>{
    const phone='+923001234568';const sid='VE'+'b'.repeat(32);
    const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({sid,status:'pending'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({to:phone,status:'pending'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({to:phone,status:'approved'})));
    vi.stubGlobal('fetch',fetch);
    const result=await requestPhoneCode(phone,42);
    expect(result).not.toHaveProperty('devOtp');
    await expect(checkPhoneCode(result.challenge,'123456',0)).rejects.toThrow('invalid');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(checkPhoneCode(result.challenge,'123456',42)).rejects.toThrow('invalid');
    await expect(checkPhoneCode(result.challenge,'123456',42)).resolves.toBe(phone);
  });
  it('rejects tampered and expired challenges without checking the provider',async()=>{
    const sid='VE'+'c'.repeat(32); const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({sid,status:'pending'})));
    vi.stubGlobal('fetch',fetch);
    const result=await requestPhoneCode('+923001234569');
    await expect(checkPhoneCode(result.challenge+'bad','123456')).rejects.toThrow('invalid');
    const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+700000);
    await expect(checkPhoneCode(result.challenge,'123456')).rejects.toThrow('expired');now.mockRestore();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
