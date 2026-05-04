import { SignJWT, jwtVerify } from "jose";

const TTL_SEC = 60 * 60 * 24 * 7;

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters (use .env.local)."
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(
  userId: string,
  email: string
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ id: string; email: string } | null> {
  if (!token) {
    return null;
  }
  try {
    let key: Uint8Array;
    try {
      key = secretKey();
    } catch {
      return null;
    }
    const { payload } = await jwtVerify(token, key);
    const id = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!id || typeof id !== "string") {
      return null;
    }
    return { id, email };
  } catch {
    return null;
  }
}
