import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "./passwords";
import { assertOtpDevelopmentEnabled, safeUser } from "./auth";
import type { User } from "../db/schema";
import { vi } from "vitest";

describe("password authentication", () => {
  it("salts password hashes and verifies without accepting a wrong password", async () => {
    const a = await hashPassword("a long unique passphrase");
    const b = await hashPassword("a long unique passphrase");
    expect(a).not.toBe(b);
    expect(a).not.toContain("passphrase");
    expect(await verifyPassword("a long unique passphrase", a)).toBe(true);
    expect(await verifyPassword("wrong passphrase", a)).toBe(false);
    expect(await verifyPassword("anything", DUMMY_PASSWORD_HASH)).toBe(false);
  });
  it("fails closed for malformed stored hashes", async () => {
    expect(
      await verifyPassword("password", "scrypt$9999999999$8$1$salt$hash")
    ).toBe(false);
  });
  it("never exposes passwordHash in user responses", () => {
    expect(safeUser({ id: 1, passwordHash: "secret" } as User)).toEqual({
      id: 1,
    });
  });
  it("rejects development OTP in production even when provider says dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OTP_PROVIDER", "dev");
    try {
      expect(() => assertOtpDevelopmentEnabled()).toThrow(
        "Use verified phone sign-in."
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("rejects an unimplemented SMS adapter", () => {
    vi.stubEnv("OTP_PROVIDER", "sms");
    try {
      expect(() => assertOtpDevelopmentEnabled()).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
