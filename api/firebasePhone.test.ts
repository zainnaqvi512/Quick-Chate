import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  getApps: () => [],
  initializeApp: vi.fn(() => ({})),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken }) }));
import { verifyFirebasePhone } from "./firebasePhone";
const valid = () => ({
  firebase: { sign_in_provider: "phone" },
  phone_number: "+923001234567",
  auth_time: Math.floor(Date.now() / 1000),
});
beforeEach(() => {
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
  verifyIdToken.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("uses only the phone number from a verified recent phone token", async () => {
  verifyIdToken.mockResolvedValue(valid());
  await expect(verifyFirebasePhone("signed-token")).resolves.toBe(
    "+923001234567"
  );
  expect(verifyIdToken).toHaveBeenCalledWith("signed-token");
});
it("fails closed when Firebase rejects signature, expiry, issuer or audience", async () => {
  verifyIdToken.mockRejectedValue(new Error("invalid token"));
  await expect(verifyFirebasePhone("untrusted-token")).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});
it.each([
  { firebase: { sign_in_provider: "password" } },
  { phone_number: undefined },
  { phone_number: "03001234567" },
  { auth_time: 1 },
  { auth_time: undefined },
  { auth_time: Math.floor(Date.now() / 1000) + 3600 },
])("rejects non-phone, malformed or stale verification: %j", async override => {
  verifyIdToken.mockResolvedValue({ ...valid(), ...override });
  await expect(verifyFirebasePhone("token")).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});
it("never accepts an emulator configured on the public authentication path", async () => {
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");
  await expect(verifyFirebasePhone("token")).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });
  expect(verifyIdToken).not.toHaveBeenCalled();
});
