"use client";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

async function handleAuthResponse(res: Response): Promise<boolean> {
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get("Location");
    window.location.href = loc ?? "/";
    return true;
  }
  return false;
}

function LoginForm() {
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth"
      ? "Sign-in could not be completed. Use email and password below, or try again."
      : null
  );
  const [loading, setLoading] = useState(false);

  const redirectTo = useCallback(
    () => getSafeRedirectPath(params.get("next")),
    [params]
  );

  async function signInWithPassword() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({
          email: email.trim(),
          password,
          redirectTo: redirectTo(),
        }),
      });

      if (await handleAuthResponse(res)) {
        return;
      }

      const payload = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        setError(payload?.error?.message ?? "Could not sign in.");
        return;
      }

      window.location.href = redirectTo();
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
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({
          email: email.trim(),
          password,
          redirectTo: redirectTo(),
        }),
      });

      if (await handleAuthResponse(res)) {
        return;
      }

      const payload = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        const msg =
          payload?.error?.message ?? "Could not create account.";
        setError(msg);
        return;
      }

      window.location.href = redirectTo();
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void signInWithPassword();
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Sign in to DocSync
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Email and password only for local development. No password reset or email verification.
      </p>

      {/* No <form>: avoids accidental POST /login document navigations in dev */}
      <div className="mt-8 space-y-4" onKeyDown={onKeyDown}>
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
            type="button"
            disabled={loading}
            onClick={() => void signInWithPassword()}
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
      </div>
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
