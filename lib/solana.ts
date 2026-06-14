// ─── Solana web3.js helpers ───────────────────────────────────────────────────
// Thin wrappers around @solana/web3.js for use in API routes.
// Client-side wallet interactions use @solana/wallet-adapter-react instead.

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com",
  "confirmed"
);

export const PKMN_MINT = process.env.NEXT_PUBLIC_PKMN_MINT!;

// Validate a Solana public key string (base58, 32 bytes on ed25519 curve)
export function isValidPublicKey(address: string): boolean {
  try {
    const pk = new PublicKey(address);
    return PublicKey.isOnCurve(pk.toBytes());
  } catch {
    return false;
  }
}

export function lamportsToSol(lamports: number | string): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}
