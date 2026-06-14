import * as nacl from "tweetnacl";
import bs58 from "bs58";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET   = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_ISSUER   = "pkmn-solana";
const JWT_AUDIENCE = "pkmn-solana-app";

// ─── SIWS — Sign In With Solana ───────────────────────────────────────────────
// Follows the SIWS spec (EIP-4361 port for Solana).
// The client constructs the same message, signs it with Phantom/Backpack,
// and sends { message, signature, publicKey } to /api/auth/verify.

export function createSiwsMessage(
  publicKey: string,
  nonce: string,
  domain: string,
  uri: string
): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    publicKey,
    "",
    "Sign in to $PKMN on Solana. Gotta catch em all.",
    "",
    `URI: ${uri}`,
    "Version: 1",
    "Chain ID: mainnet-beta",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

// ─── Verify SIWS: ed25519 signature ───────────────────────────────────────────
// signature is base58-encoded (as returned by Phantom signMessage)
export function verifySiws(
  message: string,
  signatureBase58: string,
  publicKeyBase58: string
): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureBase58);
    const pubBytes = bs58.decode(publicKeyBase58);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return false;
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────
export async function signJwt(wallet: string): Promise<string> {
  return new SignJWT({ wallet })
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

// ─── Nonce store (in-memory, swap for Redis/Supabase in prod) ─────────────────
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
