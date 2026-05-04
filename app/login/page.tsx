"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth"
      ? "Sign-in could not be completed. Use email and password below, or try again."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithPassword() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { message?: string; code?: string };
      } | null;

      if (!res.ok) {
        const msg =
          payload?.error?.message ??
          (res.status === 503
            ? "Create account is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY to .env.local."
            : "Could not create account.");
        setError(msg);
        return;
      }

      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
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
        Email and password only. Credentials are checked by Supabase Auth; this screen does not send
        magic links or other email from the app.
      </p>

      <form onSubmit={signInWithPassword} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
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
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none ring-slate-400 focus:ring-2"
            placeholder="At least 6 characters"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Working…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void signUpWithPassword()}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Create account
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-xs text-slate-500">
        <Link href="https://supabase.com/docs/guides/auth/passwords" className="underline">
          Supabase email and password auth
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
