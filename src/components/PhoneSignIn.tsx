import { useEffect, useRef, useState, type FormEvent } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { firebaseConfig } from "../../shared/firebaseConfig";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function firebaseAuth() {
  const app =
    getApps().find(app => app.name === "quick-chat-phone") ??
    initializeApp(firebaseConfig, "quick-chat-phone");
  return getAuth(app);
}
function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/operation-not-allowed":
      "Phone sign-in is not enabled in Firebase yet.",
    "auth/billing-not-enabled":
      "Firebase SMS requires Blaze billing to be enabled by the app owner.",
    "auth/unauthorized-domain":
      "This website must be added to Firebase's authorized domains.",
    "auth/invalid-app-credential":
      "App verification failed. Check the authorized domain and retry the security check.",
    "auth/captcha-check-failed":
      "The security check expired or failed. Please try again.",
    "auth/too-many-requests":
      "Too many attempts. Wait before requesting another code.",
    "auth/quota-exceeded": "The SMS quota has been reached. Please try later.",
    "auth/invalid-phone-number":
      "Enter a valid phone number with its country dial code.",
    "auth/invalid-verification-code":
      "That code is incorrect. Check the SMS and try again.",
    "auth/code-expired": "That SMS code has expired. Request another code.",
    "auth/network-request-failed":
      "Unable to reach Firebase. Check your connection and try again.",
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error
      ? error.message
      : "Sign-in failed. Please try again.")
  );
}

export function PhoneSignIn({
  link = false,
  onLinked,
}: {
  link?: boolean;
  onLinked?: () => void;
}) {
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+92");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [linked, setLinked] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const captchaContainer = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifiedToken = useRef<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const verify = trpc.phone.firebaseVerify.useMutation();
  const verifyLink = trpc.phone.firebaseLink.useMutation();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      verifier.current?.clear();
      verifier.current = null;
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const auth = firebaseAuth();
      if (!confirmation.current) {
        if (Date.now() < retryAt)
          throw new Error("Wait 60 seconds between SMS requests.");
        const number = parsePhoneNumberFromString(
          phone.trim().startsWith("+") ? phone.trim() : `${countryCode}${phone}`
        );
        if (!number?.isValid())
          throw new Error("Enter a valid phone number and country dial code.");
        await setPersistence(auth, inMemoryPersistence);
        if (!mounted.current || !captchaContainer.current) return;
        verifier.current?.clear();
        verifier.current = new RecaptchaVerifier(
          auth,
          captchaContainer.current,
          { size: "normal" }
        );
        setRetryAt(Date.now() + 60_000);
        confirmation.current = await signInWithPhoneNumber(
          auth,
          number.number,
          verifier.current
        );
        setSentTo(number.number);
        verifier.current.clear();
        verifier.current = null;
      } else {
        // A retry after an API outage must not attempt to consume the SMS twice.
        if (!verifiedToken.current) {
          const result = await confirmation.current.confirm(code);
          verifiedToken.current = await result.user.getIdToken();
        }
        const idToken = verifiedToken.current;
        if (link) {
          await verifyLink.mutateAsync({ idToken });
          setLinked(true);
          onLinked?.();
        } else {
          const result = await verify.mutateAsync({ idToken });
          setAuth(result.token);
        }
        verifiedToken.current = null;
        await signOut(auth).catch(() => {});
      }
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
      if (!confirmation.current) {
        verifier.current?.clear();
        verifier.current = null;
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  if (Capacitor.isNativePlatform())
    return (
      <div className="space-y-3 text-sm">
        <p>
          Firebase phone sign-in for this mobile build is awaiting native app
          registration. Use Quick Chat in your browser for now.
        </p>
        <a
          className="text-blue-600 underline"
          href="https://quick-chat-preview-production.up.railway.app/auth"
          target="_blank"
          rel="noreferrer"
        >
          Open Quick Chat web sign-in
        </a>
      </div>
    );
  if (linked)
    return (
      <p role="status">
        Phone verified and linked. Your existing chats are unchanged.
      </p>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      {!link && !sentTo && (
        <div className="grid grid-cols-2 gap-2" aria-label="Account access">
          {(["signin", "signup"] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={pending}
              onClick={() => setMode(value)}
              className={`rounded-lg p-3 text-sm font-medium ${mode === value ? "bg-blue-600 text-white" : "border"}`}
            >
              {value === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}
      <h2 className="text-xl font-semibold">
        {link
          ? "Verify your phone to continue"
          : mode === "signup"
            ? "Create your Quick Chat account"
            : "Welcome back"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Verify your phone number with an SMS code. New numbers create an
        account; existing numbers sign in.
      </p>
      {!sentTo ? (
        <div className="flex gap-2">
          <div className="w-24">
            <label htmlFor="phone-country" className="text-sm">
              Dial code
            </label>
            <Input
              id="phone-country"
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              pattern="\+[1-9][0-9]{0,3}"
              maxLength={5}
              disabled={pending}
              required
            />
          </div>
          <div className="flex-1">
            <label htmlFor="phone-number" className="text-sm">
              Phone number
            </label>
            <Input
              id="phone-number"
              type="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0300 1234567"
              maxLength={32}
              disabled={pending}
              required
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm mb-3">Code sent to {sentTo}</p>
          <label htmlFor="sms-code" className="text-sm">
            Verification code
          </label>
          <Input
            id="sms-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            disabled={pending}
            required
          />
        </div>
      )}
      <div ref={captchaContainer} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending}>
        {pending
          ? "Please wait…"
          : sentTo
            ? "Verify code"
            : "Send verification code"}
      </Button>
      {sentTo && (
        <button
          type="button"
          className="text-sm text-blue-600"
          disabled={pending}
          onClick={() => {
            confirmation.current = null;
            verifiedToken.current = null;
            setSentTo("");
            setCode("");
            setError("");
            void signOut(firebaseAuth()).catch(() => {});
          }}
        >
          Change number or request another code (60-second wait)
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        By requesting a code, you agree to receive an authentication SMS and to
        Google processing and storing your phone number for spam and abuse
        prevention. Carrier charges may apply.
      </p>
    </form>
  );
}
