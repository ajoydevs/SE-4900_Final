import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
