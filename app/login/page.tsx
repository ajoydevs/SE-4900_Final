"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth"
      ? "That sign-in link was invalid or expired. Request a new one."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const redirect = `${window.location.origin}/auth/callback`;
      const { error: signErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirect },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      // #region agent log
      fetch("http://127.0.0.1:7792/ingest/18dde792-c522-4d1c-b861-703aa48af361", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "2b5a29",
        },
        body: JSON.stringify({
          sessionId: "2b5a29",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "app/login/page.tsx:otp-sent",
          message: "signInWithOtp succeeded",
          data: { origin: window.location.origin },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setMessage("Check your email for the magic link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Sign in to DocSync
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Passwordless email link. No account password is stored in DocSync.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none ring-slate-400 focus:ring-2"
            placeholder="you@company.com"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700" role="status">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send magic link"}
        </button>
      </form>
      <p className="mt-8 text-center text-xs text-slate-500">
        <Link href="https://supabase.com/docs/guides/auth/auth-magic-link" className="underline">
          How magic links work
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-6 py-16 text-sm text-slate-600">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
