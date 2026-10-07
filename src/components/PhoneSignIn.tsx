import { useState, type FormEvent } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PhoneSignIn({
  link = false,
  onLinked,
}: {
  link?: boolean;
  onLinked?: () => void;
}) {
  const { setAuth } = useAuth();
  const available = trpc.phone.availability.useQuery(undefined, {
    retry: false,
  });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [countryCode, setCountryCode] = useState("+92");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const requested = (r: { challenge: string; phone: string }) => {
    setChallenge(r.challenge);
    setSentTo(r.phone);
    setError("");
  };
  const failed = (e: { message: string }) => setError(e.message);
  const request = trpc.phone.request.useMutation({
    onSuccess: requested,
    onError: failed,
  });
  const requestLink = trpc.phone.requestLink.useMutation({
    onSuccess: requested,
    onError: failed,
  });
  const verify = trpc.phone.verify.useMutation({
    onSuccess: r => setAuth(r.token),
    onError: failed,
  });
  const verifyLink = trpc.phone.verifyLink.useMutation({
    onSuccess: () => {
      setSent(true);
      onLinked?.();
    },
    onError: failed,
  });
  const pending =
    request.isPending ||
    requestLink.isPending ||
    verify.isPending ||
    verifyLink.isPending;
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (challenge) (link ? verifyLink : verify).mutate({ challenge, code });
    else (link ? requestLink : request).mutate({ countryCode, phone });
  }
  if (sent)
    return (
      <p role="status" className="text-sm text-green-600">
        Phone verified and linked. Your existing chats are unchanged.
      </p>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      {!link && !challenge && (
        <div className="grid grid-cols-2 gap-2" aria-label="Account access">
          {(["signin", "signup"] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
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
        We verify that you own the number with an SMS code. Only other Quick
        Chat accounts can be found here.
      </p>
      {available.isLoading ? (
        <p role="status">Checking SMS availability…</p>
      ) : (
        !available.data?.ready && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            SMS sign-in is awaiting provider setup. No code will be sent yet. A
            verified phone number is required to continue.
          </p>
        )
      )}
      {!challenge ? (
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
            pattern="[0-9]{4,10}"
            maxLength={10}
            required
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending || !available.data?.ready}>
        {pending
          ? "Please wait…"
          : challenge
            ? "Verify code"
            : "Send verification code"}
      </Button>
      {challenge && (
        <button
          type="button"
          className="text-sm text-blue-600"
          disabled={pending}
          onClick={() => {
            setChallenge("");
            setCode("");
            setError("");
          }}
        >
          Change number or request another code (60-second resend limit)
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        By requesting a code, you agree to receive an authentication SMS.
        Carrier charges may apply. Delivery depends on country and provider
        coverage.
      </p>
    </form>
  );
}
