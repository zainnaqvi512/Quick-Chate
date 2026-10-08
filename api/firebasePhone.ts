import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { TRPCError } from "@trpc/server";
import { firebaseConfig } from "../shared/firebaseConfig";

export async function verifyFirebasePhone(idToken: string): Promise<string> {
  // Never accept unsigned emulator tokens in this public authentication path.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Firebase emulator authentication is disabled.",
    });
  try {
    const app =
      getApps().find(app => app.name === "quick-chat-phone") ??
      initializeApp(
        { projectId: firebaseConfig.projectId },
        "quick-chat-phone"
      );
    // Verifies Google signature, expiry, audience and issuer. No service-account
    // private key is needed for public-key verification. Revocation is not checked.
    const claims = await getAuth(app).verifyIdToken(idToken);
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.firebase?.sign_in_provider !== "phone" ||
      !/^\+[1-9]\d{6,14}$/.test(claims.phone_number ?? "") ||
      !Number.isInteger(claims.auth_time) ||
      claims.auth_time > now + 30 ||
      now - claims.auth_time > 300
    )
      throw new Error("Recent phone verification required");
    return claims.phone_number!;
  } catch {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "Phone verification expired or was invalid. Request a new SMS code.",
    });
  }
}
