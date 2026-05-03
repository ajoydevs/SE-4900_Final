"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold tracking-wide text-slate-900">
            DocSync
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
