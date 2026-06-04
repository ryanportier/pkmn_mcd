import { SiweMessage } from "siwe";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_ISSUER = "pkmn-eth";
const JWT_AUDIENCE = "pkmn-eth-app";

// ─── Create a SIWE message for the client to sign ────────────────────────────
export function createSiweMessage(
  address: string,
  chainId: number,
  nonce: string,
  domain: string,
  uri: string
): string {
  const message = new SiweMessage({
    domain,
    address,
    statement: "Sign in to $PKMN . Gotta catch em all.",
    uri,
    version: "1",
    chainId,
    nonce,
  });
  return message.prepareMessage();
}

// ─── Verify SIWE message + signature ─────────────────────────────────────────
export async function verifySiwe(
  message: string,
  signature: string
): Promise<string | null> {
  try {
    const siweMsg = new SiweMessage(message);
    const { data } = await siweMsg.verify({ signature });
    return data.address.toLowerCase();
  } catch {
    return null;
  }
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────
export async function signJwt(wallet: string): Promise<string> {
  return new SignJWT({ wallet: wallet.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return (payload.wallet as string) ?? null;
  } catch {
    return null;
  }
}

// ─── Nonce store (in-memory, swap for Redis/Supabase in prod) ────────────────
const nonces = new Map<string, { value: string; expiresAt: number }>();

export function generateNonce(): string {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  nonces.set(nonce, { value: nonce, expiresAt: Date.now() + 5 * 60 * 1000 });
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const entry = nonces.get(nonce);
  if (!entry || entry.expiresAt < Date.now()) return false;
  nonces.delete(nonce);
  return true;
}
