import { Logo } from "@/components/Logo";
import { MessageCircle, Clock3 } from "lucide-react";
import { PhoneSignIn } from "@/components/PhoneSignIn";

export default function AuthPage() {
  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-3xl overflow-hidden border bg-card shadow-xl">
        <section className="bg-blue-600 text-white p-8 md:p-12 flex flex-col justify-between gap-10">
          <div className="flex items-center gap-3">
            <Logo size={42} />
            <span className="text-xl font-semibold tracking-tight">
              Quick Chat
            </span>
          </div>
          <div>
            <span className="text-blue-100 text-xs tracking-widest uppercase">
              A little less permanent
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              Say hello.
              <br />
              Stay in the moment.
            </h1>
            <p className="mt-5 text-blue-100 leading-relaxed">
              A simple place for your everyday conversations, with disappearing
              messages on your terms.
            </p>
          </div>
          <div className="space-y-3 text-sm text-blue-100">
            <p className="flex items-center gap-3">
              <MessageCircle size={18} />
              One-to-one chats and groups
            </p>
            <p className="flex items-center gap-3">
              <Clock3 size={18} />
              Choose when your messages disappear
            </p>
          </div>
        </section>
        <section className="p-8 md:p-12 flex flex-col justify-center">
          <PhoneSignIn />
        </section>
      </div>
    </main>
  );
}
