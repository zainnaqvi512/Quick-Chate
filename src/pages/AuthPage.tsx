import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";

type Step = "phone" | "otp";

export default function AuthPage() {
  const { setAuth } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [countryOpen, setCountryOpen] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: (res) => {
      setStep("otp");
      setError("");
      setCooldown(45);
      setDevOtp(res.devOtp ?? null);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    },
    onError: (e) => setError(e.message),
  });

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: (res) => {
      // Session created; profile completion is gated in the main app.
      setAuth(res.token);
    },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function sendOtp() {
    if (!phone.replace(/\D/g, "")) {
      setError("Please enter your phone number");
      return;
    }
    setError("");
    requestOtp.mutate({ countryCode: country.dial, phone });
  }

  function submitOtp(code: string) {
    setError("");
    verifyOtp.mutate({ countryCode: country.dial, phone, otp: code });
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-sky-600 dark:text-sky-400">Quick Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground text-center">
            Fast, private messaging. Chats expire 12 hours after being read.
          </p>
        </div>

        <div className="bg-card border rounded-2xl shadow-lg p-6 space-y-5">
          {step === "phone" && (
            <>
              <h2 className="text-lg font-semibold">Your phone number</h2>
              <p className="text-sm text-muted-foreground -mt-3">
                We'll send you a 6-digit verification code.
              </p>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Select country"
                  onClick={() => setCountryOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                >
                  <span>
                    {country.flag} {country.name} ({country.dial})
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                {countryOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-popover shadow-md">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.name}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCountry(c);
                          setCountryOpen(false);
                        }}
                      >
                        {c.flag} {c.name} ({c.dial})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border px-3 py-2.5 text-sm bg-muted text-muted-foreground">
                  {country.dial}
                </span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                  placeholder="3XX XXXXXXX"
                  inputMode="tel"
                  aria-label="Phone number"
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  className="py-2.5"
                />
              </div>
              <Button
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                onClick={sendOtp}
                disabled={requestOtp.isPending}
              >
                {requestOtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send code
              </Button>
            </>
          )}

          {step === "otp" && (
            <>
              <h2 className="text-lg font-semibold">Enter verification code</h2>
              <p className="text-sm text-muted-foreground -mt-3">
                Sent to {country.dial} {phone}
              </p>
              {devOtp && (
                <div className="rounded-lg bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 px-3 py-2 text-sm text-sky-700 dark:text-sky-300">
                  Development mode — your code is <b className="font-mono tracking-widest">{devOtp}</b>
                </div>
              )}
              <div className="flex gap-2 justify-center" role="group" aria-label="Verification code">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    value={otp[i] || ""}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    className="w-11 h-13 text-center text-xl font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-sky-500 h-12"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      const next = (otp.slice(0, i) + v + otp.slice(i + 1)).slice(0, 6);
                      setOtp(next);
                      if (v && i < 5) otpRefs.current[i + 1]?.focus();
                      if (next.length === 6) submitOtp(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              {verifyOtp.isPending && (
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <button className="text-muted-foreground hover:underline" onClick={() => setStep("phone")}>
                  Change number
                </button>
                <button
                  className="text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                  disabled={cooldown > 0 || requestOtp.isPending}
                  onClick={sendOtp}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
          Codes are hashed and expire after 10 minutes.
        </p>
      </div>
    </div>
  );
}
