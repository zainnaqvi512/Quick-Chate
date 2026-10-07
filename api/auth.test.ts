import { describe, it, expect } from "vitest";
import { normalizePhone, hashOtp, generateOtp } from "./auth";

describe("phone normalization", () => {
  it('keeps an international number intact regardless of selected country',()=>{
    expect(normalizePhone('+92','+44 7700 900123')).toBe('+447700900123');
  });
  it('preserves significant Italian leading zero',()=>{
    expect(normalizePhone('+39','02 36618 300')).toBe('+390236618300');
  });
  it("normalizes Pakistani numbers", () => {
    expect(normalizePhone("+92", "300 1234567")).toBe("+923001234567");
  });
  it("strips leading zeros", () => {
    expect(normalizePhone("+92", "03001234567")).toBe("+923001234567");
  });
  it("strips formatting characters", () => {
    expect(normalizePhone("+1", "(555) 000-1111")).toBe("+15550001111");
  });
  it("rejects too-short numbers", () => {
    expect(() => normalizePhone("+92", "12")).toThrow();
  });
  it("rejects empty national part", () => {
    expect(() => normalizePhone("+92", "")).toThrow();
  });
});

describe("OTP security", () => {
  it("never stores plaintext (hash only)", () => {
    const h = hashOtp("+9200000000", "123456");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain("123456");
  });
  it("hash is deterministic per phone+otp", () => {
    expect(hashOtp("+1", "654321")).toBe(hashOtp("+1", "654321"));
  });
  it("same otp for different phones hashes differently", () => {
    expect(hashOtp("+1", "111111")).not.toBe(hashOtp("+2", "111111"));
  });
  it("generates 6-digit codes", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });
});
