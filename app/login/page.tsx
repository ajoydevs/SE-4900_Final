"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type AuthMethod = "magic" | "password";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/";

  const [method, setMethod] = useState<AuthMethod>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth"
      ? "That sign-in link was invalid or expired. Request a new one."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
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
      setMessage("Check your email for the magic link.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
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
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const redirect = `${window.location.origin}/auth/callback`;
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirect },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      if (data.session) {
        router.replace(next.startsWith("/") ? next : "/");
        router.refresh();
        return;
      }
      setMessage("Check your email to confirm your account, then sign in with email and password.");
      setPassword("");
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
        Sign in with a one-time magic link or with email and password (stored by Supabase Auth, not
        in DocSync application code).
      </p>

      <div className="mt-6 flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-medium">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 transition-colors ${
            method === "magic" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
          onClick={() => {
            setMethod("magic");
            setError(null);
            setMessage(null);
          }}
        >
          Magic link
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 transition-colors ${
            method === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
          onClick={() => {
            setMethod("password");
            setError(null);
            setMessage(null);
          }}
        >
          Email & password
        </button>
      </div>

      {method === "magic" ? (
        <form onSubmit={sendMagicLink} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email-magic" className="block text-sm font-medium text-slate-700">
              Work email
            </label>
            <input
              id="email-magic"
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
      ) : (
        <form onSubmit={signInWithPassword} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email-pass" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email-pass"
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
          {message ? (
            <p className="text-sm text-emerald-700" role="status">
              {message}
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
      )}

      {method === "magic" ? (
        <p className="mt-8 text-center text-xs text-slate-500">
          <Link href="https://supabase.com/docs/guides/auth/auth-magic-link" className="underline">
            How magic links work
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link
            href="https://supabase.com/docs/guides/auth/passwords"
            className="underline"
          >
            Supabase email & password auth
          </Link>
        </p>
      )}
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
