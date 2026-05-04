import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { verifySessionToken } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getServerSession(): Promise<{
  id: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(raw);
}

export async function requireServerSession(): Promise<{
  id: string;
  email: string;
}> {
  const s = await getServerSession();
  if (!s) {
    redirect("/login");
  }
  return s;
}
