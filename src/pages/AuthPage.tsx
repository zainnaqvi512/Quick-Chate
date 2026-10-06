import { useState, type FormEvent } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Clock3 } from "lucide-react";

export default function AuthPage() {
  const { setAuth } = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation({ onSuccess: (r) => setAuth(r.token), onError: (e) => setError(e.message) });
  const signup = trpc.auth.register.useMutation({ onSuccess: (r) => setAuth(r.token), onError: (e) => setError(e.message) });
  const pending = login.isPending || signup.isPending;
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (register) signup.mutate({ email, password, name, username });
    else login.mutate({ email, password });
  }
  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-3xl overflow-hidden border bg-card shadow-xl">
        <section className="bg-blue-600 text-white p-8 md:p-12 flex flex-col justify-between gap-10">
          <div className="flex items-center gap-3"><Logo size={42}/><span className="text-xl font-semibold tracking-tight">Quick Chat</span></div>
          <div>
            <span className="text-blue-100 text-xs tracking-widest uppercase">A little less permanent</span>
            <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight tracking-tight">Say hello.<br/>Stay in the moment.</h1>
            <p className="mt-5 text-blue-100 leading-relaxed">A simple place for your everyday conversations, with disappearing messages on your terms.</p>
          </div>
          <div className="space-y-3 text-sm text-blue-100">
            <p className="flex items-center gap-3"><MessageCircle size={18}/>One-to-one chats and groups</p>
            <p className="flex items-center gap-3"><Clock3 size={18}/>Choose when your messages disappear</p>
          </div>
        </section>
        <section className="p-8 md:p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-semibold tracking-tight">{register ? "Create your account" : "Welcome back"}</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-7">{register ? "Choose a username so friends can find you." : "Sign in to your Quick Chat account."}</p>
          <form onSubmit={submit} className="space-y-4">
            {register && <>
              <div><label htmlFor="name" className="text-sm font-medium">Your name</label><Input id="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={128} className="mt-1.5"/></div>
              <div><label htmlFor="username" className="text-sm font-medium">Username</label><Input id="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} required pattern="[a-z][a-z0-9_]{2,31}" title="3–32 letters, numbers or underscores; start with a letter" maxLength={32} className="mt-1.5"/><p className="text-xs text-muted-foreground mt-1">3–32 characters; start with a letter.</p></div>
            </>}
            <div><label htmlFor="email" className="text-sm font-medium">Email address</label><Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} placeholder="you@example.com" className="mt-1.5"/></div>
            <div><label htmlFor="password" className="text-sm font-medium">Password</label><Input id="password" type="password" autoComplete={register ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} className="mt-1.5"/>{register && <p className="text-xs text-muted-foreground mt-1">At least 12 characters. A unique passphrase works well.</p>}</div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">{pending && <Loader2 size={16} className="animate-spin mr-2"/>}{register ? "Create account" : "Sign in"}</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-6">{register ? "Already have an account?" : "New to Quick Chat?"} <button type="button" disabled={pending} onClick={() => { setRegister(!register); setError(""); }} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">{register ? "Sign in" : "Create account"}</button></p>
          <p className="mt-7 text-xs text-muted-foreground leading-relaxed">Email verification and password recovery are not available yet. Keep your password safe. Disappearing messages cannot prevent screenshots or copies.</p>
        </section>
      </div>
    </main>
  );
}
